// 洛雪音源运行时 — 子 env 内的 lx 预置环境（异步模型）
//
// 此处导出一个字符串常量 LX_PRELUDE_JS，作为 songloft.jsenv.create 的 initCode
// 在每个音源专属的子 QuickJS VM 中执行。子 env 完全隔离，原生 Promise / setTimeout
// 通过宿主的 processJobs 在 executeWait 的 polling loop 内被驱动。
//
// 关键事件：
//  - lx.send('inited', {sources}) → 父侧通过 executeWait(['inited']) 拿到音源配置
//  - lx.send('dispatchResult', {id,result}) / lx.send('dispatchError', {id,error})
//    → 父侧通过 executeWait(['dispatchResult','dispatchError']) 拿到 request 处理结果
//
// 参考：plugins/songloft-plugin-lxmusic/engine/lx_prelude.js（Go WASM 版同款）

export const LX_PRELUDE_JS = `
'use strict';

// 事件处理器注册表
var _eventHandlers = new Map();

// 已注册的音源（来自脚本 lx.send('inited', {sources})）
var _registeredSources = {};

// 脚本元数据（由父侧通过 execute 注入）
var _scriptInfo = {
    name: '', description: '', version: '', author: '', homepage: '', rawScript: ''
};

globalThis.lx = {
    version: '2.0.0',
    env: 'desktop',
    platform: 'web',
    currentScriptInfo: _scriptInfo,

    EVENT_NAMES: {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert'
    },

    // utils 包装宿主 polyfill
    utils: {
        buffer: {
            from: function(data, encoding) {
                return Buffer.from(data, encoding);
            },
            bufToString: function(buf, format) {
                if (typeof buf === 'object' && buf !== null && typeof buf.toString === 'function') {
                    return buf.toString(format || 'utf8');
                }
                return Buffer.from(buf, 'binary').toString(format || 'utf8');
            }
        },
        crypto: {
            md5: function(str) { return crypto.md5(str || ''); },
            aesEncrypt: function(buffer, mode, key, iv) {
                return crypto.aesEncrypt(buffer, mode, key, iv);
            },
            rsaEncrypt: function(buffer, key) {
                return crypto.rsaEncrypt(buffer, key);
            },
            randomBytes: function(size) {
                return crypto.randomBytes(size);
            }
        },
        zlib: {
            inflate: function(buffer) { return zlib.inflate(buffer); },
            deflate: function(buffer) { return zlib.deflate(buffer); }
        }
    },

    // HTTP 请求 — 回调风格（参考 lx-music-desktop 的 lx.request）
    // signature: lx.request(url, options, callback)
    //   callback(error, response, body)
    //   response = { statusCode, statusMessage, headers, body }
    request: function(url, options, callback) {
        if (typeof options === 'function') { callback = options; options = {}; }
        options = options || {};

        var method = (options.method || 'GET').toUpperCase();
        var headers = options.headers || {};

        // body / form / formData
        var bodyContent = options.body || null;
        if (options.form) {
            bodyContent = options.form;
            if (typeof bodyContent === 'object') {
                var parts = [];
                var formKeys = Object.keys(bodyContent);
                for (var fi = 0; fi < formKeys.length; fi++) {
                    parts.push(encodeURIComponent(formKeys[fi]) + '=' + encodeURIComponent(bodyContent[formKeys[fi]]));
                }
                bodyContent = parts.join('&');
                if (!headers['Content-Type'] && !headers['content-type']) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                }
            }
        } else if (options.formData) {
            bodyContent = options.formData;
        }
        if (bodyContent !== null && typeof bodyContent === 'object') {
            bodyContent = JSON.stringify(bodyContent);
            if (!headers['Content-Type'] && !headers['content-type']) {
                headers['Content-Type'] = 'application/json';
            }
        }

        var aborted = false;
        var callbackCalled = false;
        function safeCallback(err, response, body) {
            if (callbackCalled || aborted) return;
            callbackCalled = true;
            if (typeof callback === 'function') {
                try { callback(err, response, body); }
                catch (cbErr) { console.error('[lx.request] callback threw: ' + cbErr); }
            }
        }

        var fetchOptions = { method: method, headers: headers };
        if (bodyContent) fetchOptions.body = bodyContent;

        fetch(url, fetchOptions).then(function(resp) {
            if (aborted) return;
            return resp.text().then(function(bodyText) {
                if (aborted) return;
                var parsedBody = bodyText;
                try { parsedBody = JSON.parse(bodyText); } catch (_) { /* keep string */ }
                var response = {
                    statusCode: resp.status,
                    statusMessage: resp.statusText || '',
                    headers: resp.headers || {},
                    body: parsedBody
                };
                safeCallback(null, response, parsedBody);
            });
        }).catch(function(err) {
            if (aborted) return;
            var errMsg = (err && err.message) ? err.message : String(err);
            safeCallback(new Error(errMsg), null, null);
        });

        // 取消函数
        return function() { aborted = true; };
    },

    // 发送事件到父侧（通过 __go_send 宿主桥接）
    send: function(eventName, data) {
        if (eventName === 'inited') {
            if (data && data.sources) {
                _registeredSources = data.sources;
            }
        }
        if (typeof __go_send === 'function') {
            try { __go_send(eventName, JSON.stringify(data)); }
            catch (e) { console.error('[lx.send] __go_send threw: ' + e); }
        }
    },

    // 注册事件处理器
    on: function(eventName, handler) {
        _eventHandlers.set(eventName, handler);
    },

    // 父侧通过 execute("lx._dispatch(reqId, 'request', payload)") 触发
    // handler 可能返回 Promise；resolve/reject 后通过 __go_send 把结果发回父侧。
    // 18 秒看门狗：若 Promise 永不 settle，发送 dispatchError 防止 executeWait 一直等。
    _dispatch: function(requestId, eventName, data) {
        var handler = _eventHandlers.get(eventName);
        if (typeof handler !== 'function') {
            if (typeof __go_send === 'function') {
                __go_send('dispatchError', JSON.stringify({
                    id: requestId,
                    error: 'No handler registered for event: ' + eventName
                }));
            }
            return;
        }

        var settled = false;
        function sendResult(value) {
            if (settled) return;
            settled = true;
            if (typeof __go_send === 'function') {
                __go_send('dispatchResult', JSON.stringify({ id: requestId, result: value }));
            }
        }
        function sendError(err) {
            if (settled) return;
            settled = true;
            var errMsg = (err && err.message) ? err.message : String(err);
            if (typeof __go_send === 'function') {
                __go_send('dispatchError', JSON.stringify({ id: requestId, error: errMsg }));
            }
        }

        try {
            var result = handler(data);
            var isThenable = (result && typeof result.then === 'function');
            if (isThenable) {
                var timeoutId = setTimeout(function() {
                    sendError(new Error('dispatch timeout: handler Promise did not settle within 18s'));
                }, 18000);
                result.then(function(value) {
                    clearTimeout(timeoutId);
                    sendResult(value);
                }, function(err) {
                    clearTimeout(timeoutId);
                    sendError(err);
                });
            } else {
                sendResult(result);
            }
        } catch (err) {
            sendError(err);
        }
    },

    _getSources: function() { return _registeredSources; }
};

// 浏览器全局别名（jsjiami 混淆脚本依赖）
globalThis.window = globalThis;
globalThis.global = globalThis;
`;

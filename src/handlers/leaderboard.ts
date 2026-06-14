// 洛雪音源插件 — 排行榜处理器
// 翻译自 Go 源码: plugins/songloft-plugin-lxmusic/handlers/leaderboard.go

import { parseQuery } from '@songloft/plugin-sdk';
import type { Router, HTTPRequest } from '@songloft/plugin-sdk';
import type { Registry } from '@songloft/musicsdk/dist/index.js';
import { successResponse, errorResponse } from './response';

/**
 * 注册排行榜相关路由
 * GET /api/leaderboard/boards → 获取排行榜分类
 * GET /api/leaderboard/list   → 获取排行榜歌曲列表
 */
export function registerLeaderboardHandlers(
  router: Router,
  registry: Registry,
): void {

  // GET /api/leaderboard/boards — 获取排行榜分类
  router.get('/api/leaderboard/boards', (req: HTTPRequest) => {
    const query = parseQuery(req.query);
    const sourceID = query.source_id;

    if (!sourceID) return errorResponse(400, '缺少 source_id 参数');

    const provider = registry.getLeaderboardProvider(sourceID);
    if (!provider) return errorResponse(400, '不支持的平台: ' + sourceID);

    try {
      const boards = provider.getBoards(sourceID);
      return successResponse(boards);
    } catch (e: any) {
      songloft.log.error(`获取排行榜分类失败: source_id=${sourceID}, error=${e.message || e}`);
      return errorResponse(500, '获取排行榜分类失败: ' + (e.message || String(e)));
    }
  });

  // GET /api/leaderboard/list — 获取排行榜歌曲列表
  router.get('/api/leaderboard/list', async (req: HTTPRequest) => {
    const query = parseQuery(req.query);
    const sourceID = query.source_id;

    if (!sourceID) return errorResponse(400, '缺少 source_id 参数');

    const provider = registry.getLeaderboardProvider(sourceID);
    if (!provider) return errorResponse(400, '不支持的平台: ' + sourceID);

    const boardID = query.board_id;
    if (!boardID) return errorResponse(400, '缺少 board_id 参数');

    let page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    try {
      const result = await provider.getList(sourceID, boardID, page);
      return successResponse({
        list: result.list,
        total: result.total,
        page,
      });
    } catch (e: any) {
      songloft.log.error(`获取排行榜列表失败: source_id=${sourceID}, board_id=${boardID}, error=${e.message || e}`);
      return errorResponse(500, '获取排行榜列表失败: ' + (e.message || String(e)));
    }
  });
}

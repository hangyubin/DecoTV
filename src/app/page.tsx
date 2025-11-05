/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

// 类型定义
type ActiveTab = 'home' | 'favorites';

interface FavoriteItem {
  id: string;
  source: string;
  title: string;
  poster: string;
  episodes: number;
  source_name: string;
  currentEpisode?: number;
  search_title?: string;
  origin?: 'vod' | 'live';
  year?: string;
}

interface HomeState {
  activeTab: ActiveTab;
  loading: boolean;
  error: string | null;
  showAnnouncement: boolean;
}

interface RecommendationSectionProps {
  title: string;
  data: DoubanItem[] | any[];
  loading: boolean;
  type: 'movie' | 'tv' | 'anime' | 'show';
  linkHref: string;
  isBangumi?: boolean;
}

// 加载骨架屏组件
const LoadingSkeleton = () => (
  <div className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44">
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800">
      <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700" />
    </div>
    <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800" />
  </div>
);

const LoadingSkeletons = ({ count = 8 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <LoadingSkeleton key={index} />
    ))}
  </>
);

// 推荐区域组件
const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  title,
  data,
  loading,
  type,
  linkHref,
  isBangumi = false,
}) => {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          {title}
        </h2>
        <Link
          href={linkHref}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          查看更多
          <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </div>
      <ScrollableRow>
        {loading ? (
          <LoadingSkeletons />
        ) : (
          data.map((item, index) => (
            <div
              key={isBangumi ? `${item.id}-${index}` : index}
              className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
            >
              <VideoCard
                from="douban"
                title={item.title || item.name_cn || item.name}
                poster={
                  item.poster ||
                  item.images?.large ||
                  item.images?.common ||
                  item.images?.medium ||
                  '/logo.png'
                }
                douban_id={Number(item.id)}
                rate={item.rating?.score?.toFixed(1) || item.rate || ''}
                year={item.air_date?.split('-')?.[0] || item.year || ''}
                isBangumi={isBangumi}
                type={type === 'movie' ? 'movie' : ''}
              />
            </div>
          ))
        )}
      </ScrollableRow>
    </section>
  );
};

function HomeClient() {
  const [state, setState] = useState<HomeState>({
    activeTab: 'home',
    loading: true,
    error: null,
    showAnnouncement: false,
  });
  
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<BangumiCalendarData[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  
  const { announcement } = useSite();

  // 更新状态的方法
  const updateState = useCallback((updates: Partial<HomeState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        updateState({ showAnnouncement: true });
      } else {
        updateState({ showAnnouncement: Boolean(!hasSeenAnnouncement && announcement) });
      }
    }
  }, [announcement, updateState]);

  // 处理收藏数据更新的函数
  const updateFavoriteItems = useCallback(async (allFavorites: Record<string, any>) => {
    try {
      const allPlayRecords = await getAllPlayRecords();

      // 根据保存时间排序（从近到远）
      const sorted = Object.entries(allFavorites)
        .sort(([, a], [, b]) => b.save_time - a.save_time)
        .map(([key, fav]) => {
          const plusIndex = key.indexOf('+');
          const source = key.slice(0, plusIndex);
          const id = key.slice(plusIndex + 1);

          // 查找对应的播放记录，获取当前集数
          const playRecord = allPlayRecords[key];
          const currentEpisode = playRecord?.index;

          return {
            id,
            source,
            title: fav.title,
            year: fav.year,
            poster: fav.cover,
            episodes: fav.total_episodes,
            source_name: fav.source_name,
            currentEpisode,
            search_title: fav?.search_title,
            origin: fav?.origin,
          } as FavoriteItem;
        });
      setFavoriteItems(sorted);
    } catch (error) {
      console.error('更新收藏数据失败:', error);
    }
  }, []);

  // 获取推荐数据
  const fetchRecommendData = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });

      // 并行获取热门电影、热门剧集和热门综艺
      const [moviesData, tvShowsData, varietyShowsData, bangumiCalendarData] =
        await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
          GetBangumiCalendarData(),
        ]);

      if (moviesData.code === 200) {
        setHotMovies(moviesData.list);
      }

      if (tvShowsData.code === 200) {
        setHotTvShows(tvShowsData.list);
      }

      if (varietyShowsData.code === 200) {
        setHotVarietyShows(varietyShowsData.list);
      }

      setBangumiCalendarData(bangumiCalendarData);
    } catch (error) {
      console.error('获取推荐数据失败:', error);
      updateState({ error: '获取推荐数据失败，请刷新页面重试' });
    } finally {
      updateState({ loading: false });
    }
  }, [updateState]);

  useEffect(() => {
    fetchRecommendData();
  }, [fetchRecommendData]);

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (state.activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      try {
        const allFavorites = await getAllFavorites();
        await updateFavoriteItems(allFavorites);
      } catch (error) {
        console.error('加载收藏数据失败:', error);
        updateState({ error: '加载收藏数据失败' });
      }
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [state.activeTab, updateFavoriteItems, updateState]);

  // 获取今日番剧数据
  const todayAnimes = useMemo(() => {
    if (!bangumiCalendarData.length) return [];

    const today = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentWeekday = weekdays[today.getDay()];

    const todayData = bangumiCalendarData.find(
      (item) => item.weekday.en === currentWeekday
    );

    return (todayData?.items || []).filter(anime => anime && anime.id);
  }, [bangumiCalendarData]);

  const handleCloseAnnouncement = useCallback((announcement: string) => {
    updateState({ showAnnouncement: false });
    localStorage.setItem('hasSeenAnnouncement', announcement);
  }, [updateState]);

  const handleClearFavorites = useCallback(async () => {
    try {
      await clearAllFavorites();
      setFavoriteItems([]);
    } catch (error) {
      console.error('清空收藏失败:', error);
      updateState({ error: '清空收藏失败' });
    }
  }, [updateState]);

  const handleTabChange = useCallback((value: string) => {
    updateState({ activeTab: value as ActiveTab });
  }, [updateState]);

  // 错误显示组件
  if (state.error) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-4">{state.error}</div>
            <button
              onClick={fetchRecommendData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="px-2 sm:px-10 py-4 sm:py-8 overflow-visible">
        {/* 顶部 Tab 切换 */}
        <div className="mb-8 flex justify-center">
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={state.activeTab}
            onChange={handleTabChange}
          />
        </div>

        <div className="max-w-[95%] mx-auto">
          {state.activeTab === 'favorites' ? (
            // 收藏夹视图
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={handleClearFavorites}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className="justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8">
                {favoriteItems.map((item) => (
                  <div key={`${item.id}-${item.source}`} className="w-full">
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from="favorite"
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8 dark:text-gray-400">
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
          ) : (
            // 首页视图
            <>
              {/* 继续观看 */}
              <ContinueWatching />

              {/* 热门电影 */}
              <RecommendationSection
                title="热门电影"
                data={hotMovies}
                loading={state.loading}
                type="movie"
                linkHref="/douban?type=movie"
              />

              {/* 热门剧集 */}
              <RecommendationSection
                title="热门剧集"
                data={hotTvShows}
                loading={state.loading}
                type="tv"
                linkHref="/douban?type=tv"
              />

              {/* 每日新番放送 */}
              <RecommendationSection
                title="新番放送"
                data={todayAnimes}
                loading={state.loading}
                type="anime"
                linkHref="/douban?type=anime"
                isBangumi={true}
              />

              {/* 热门综艺 */}
              <RecommendationSection
                title="热门综艺"
                data={hotVarietyShows}
                loading={state.loading}
                type="show"
                linkHref="/douban?type=show"
              />
            </>
          )}
        </div>
      </div>
      
      {/* 公告弹窗 */}
      {announcement && state.showAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300"
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl"
            style={{ touchAction: 'auto' }}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-400 to-indigo-500 border-b-2 border-purple-400 pb-1 drop-shadow-lg">
                公告
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className="text-purple-400 hover:text-purple-600 dark:text-purple-300 dark:hover:text-white transition-colors"
                aria-label="关闭"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <div className="relative overflow-hidden rounded-lg mb-4 p-4 bg-gradient-to-r from-purple-100 via-pink-100 to-indigo-100 dark:from-purple-900/40 dark:via-pink-900/30 dark:to-indigo-900/40 shadow-lg">
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-purple-500 via-pink-400 to-indigo-500 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400"></div>
                <p className="ml-4 text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
                  {announcement}
                </p>
                <div className="absolute right-2 bottom-2 w-8 h-8 bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-400 rounded-full blur-xl opacity-40 animate-pulse"></div>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-purple-700 hover:via-pink-600 hover:to-indigo-700 dark:from-purple-600 dark:via-pink-500 dark:to-indigo-600 dark:hover:from-purple-700 dark:hover:via-pink-600 dark:hover:to-indigo-700 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-gray-600">加载中...</div>
          </div>
        </div>
      </PageLayout>
    }>
      <HomeClient />
    </Suspense>
  );
}

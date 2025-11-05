/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
  compact?: boolean;
}

export default function ContinueWatching({ className, compact }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );

    setPlayRecords(sortedRecords);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setError('获取播放记录失败');
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  // 错误状态显示
  if (error) {
    return (
      <section className={`mb-8 ${className || ''}`}>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
            继续观看
          </h2>
        </div>
        <div className='text-center py-8 text-red-500 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-900/20'>
          <div className='text-lg mb-2'>{error}</div>
          <button
            className='text-sm underline hover:no-underline px-4 py-2 bg-red-100 dark:bg-red-800 rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors'
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                const allRecords = await getAllPlayRecords();
                updatePlayRecords(allRecords);
              } catch (err) {
                setError('重试失败，请刷新页面');
              } finally {
                setLoading(false);
              }
            }}
          >
            重试
          </button>
        </div>
      </section>
    );
  }

  // 空状态显示
  if (!loading && playRecords.length === 0) {
    return (
      <section className={`mb-8 ${className || ''}`}>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
            继续观看
          </h2>
        </div>
        <div className='text-center py-12 px-4 text-gray-500 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'>
          <div className='w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600'>
            <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
            </svg>
          </div>
          <div className='text-lg font-medium mb-2'>暂无观看记录</div>
          <div className='text-sm max-w-md mx-auto'>开始观看视频后，这里会显示您的继续观看记录</div>
        </div>
      </section>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <section className={`mb-8 ${className || ''}`}>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
            继续观看
          </h2>
        </div>
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${compact ? 'gap-3' : 'gap-4'}`}>
          {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
            <div
              key={index}
              className={`${compact ? 'min-w-[80px]' : 'min-w-[96px]'} w-full`}
            >
              <div className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800 ${
                compact ? 'rounded-md' : 'rounded-lg'
              }`}>
                <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
              </div>
              <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
              <div className='mt-1 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`mb-8 ${className || ''}`}>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          继续观看
        </h2>
        {playRecords.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
            onClick={async () => {
              if (confirm('确定要清空所有播放记录吗？')) {
                try {
                  await clearAllPlayRecords();
                  setPlayRecords([]);
                } catch (error) {
                  console.error('清空播放记录失败:', error);
                  setError('清空播放记录失败');
                }
              }
            }}
          >
            清空
          </button>
        )}
      </div>
      
      {/* 多列网格布局 */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${
        compact ? 'gap-3' : 'gap-4'
      }`}>
        {playRecords.map((record) => {
          const { source, id } = parseKey(record.key);
          return (
            <div
              key={record.key}
              className={`${compact ? 'min-w-[80px]' : 'min-w-[96px]'} w-full`}
            >
              <VideoCard
                id={id}
                title={record.title}
                poster={record.cover}
                year={record.year}
                source={source}
                source_name={record.source_name}
                progress={getProgress(record)}
                episodes={record.total_episodes}
                currentEpisode={record.index}
                query={record.search_title}
                from='playrecord'
                onDelete={() =>
                  setPlayRecords((prev) =>
                    prev.filter((r) => r.key !== record.key)
                  )
                }
                type={record.total_episodes > 1 ? 'tv' : ''}
                compact={compact}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

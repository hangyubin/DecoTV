/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 移除本地存储模式的限制，允许本地开发环境访问管理员功能
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  
  const authInfo = getAuthInfoFromCookie(request);
  
  // 对于localstorage模式，检查password字段而不是username
  if (storageType === 'localstorage') {
    if (!authInfo || !authInfo.password || authInfo.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // localstorage模式下直接使用owner权限
    try {
      const config = await getConfig();
      return NextResponse.json(
        { Role: 'owner', Config: config },
        {
          headers: {
            'Cache-Control': 'no-store', // 管理员配置不缓存
          },
        }
      );
    } catch (error) {
      console.error('获取管理员配置失败:', error);
      return NextResponse.json(
        {
          error: '获取管理员配置失败',
          details: (error as Error).message,
        },
        { status: 500 }
      );
    }
  }
  
  // 非localstorage模式的常规验证
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const config = await getConfig();
    const result: AdminConfigResult = {
      Role: 'owner',
      Config: config,
    };
    if (username === process.env.USERNAME) {
      result.Role = 'owner';
    } else {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (user && user.role === 'admin' && !user.banned) {
        result.Role = 'admin';
      } else {
        return NextResponse.json(
          { error: '你是管理员吗你就访问？' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 管理员配置不缓存
      },
    });
  } catch (error) {
    console.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

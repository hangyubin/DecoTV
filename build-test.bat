@echo off

REM DecoTV Cloudflare Pages构建测试脚本
echo 开始构建测试...

REM 安装依赖
echo 安装项目依赖...
pnpm install

if %errorlevel% neq 0 (
    echo 依赖安装失败，请检查错误信息
    exit /b %errorlevel%
)

REM 运行构建命令
echo 执行构建命令...
pnpm build

if %errorlevel% neq 0 (
    echo 构建失败，请检查错误信息
    exit /b %errorlevel%
)

REM 检查输出目录是否存在
echo 验证构建输出...
if exist "out" (
    echo 构建成功！输出目录 out 已生成
) else (
    echo 错误：构建输出目录 out 不存在
    exit /b 1
)

echo 构建测试完成！项目可以部署到Cloudflare Pages
echo 请确保在Cloudflare Pages控制台中配置以下设置：
echo 1. 构建命令：pnpm install && pnpm build
echo 2. 构建输出目录：out
echo 3. 环境变量：NODE_ENV=production

pause
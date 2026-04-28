# 上线步骤

## 1. 创建 Supabase 项目
1. 打开 Supabase，新建一个 project。
2. 进入 SQL Editor。
3. 把 `supabase.sql` 的内容完整粘贴进去并执行。
4. 执行成功后，确认已经生成 `scores` 表和 `get_leaderboard` 函数。

## 2. 获取 Supabase 配置
1. 进入 `Project Settings`。
2. 找到 `API`。
3. 复制以下两个值：
   - `Project URL`
   - `anon public key`

## 3. 本地可选联调
如果你只是本地先试：
1. 打开 `config.js`
2. 填入：
   - `window.SNAKE_SUPABASE_URL = '你的 Project URL'`
   - `window.SNAKE_SUPABASE_ANON_KEY = '你的 anon key'`
3. 然后再本地打开页面测试

## 4. 上传到 Git 仓库
1. 把整个 `snake-leaderboard` 目录上传到你的 Git 仓库。
2. 确保以下文件都在仓库里：
   - `index.html`
   - `style.css`
   - `game.js`
   - `supabase.js`
   - `config.js`
   - `supabase.sql`
   - `vercel.json`
   - `api/config.js`

## 5. 部署到 Vercel
1. 登录 Vercel。
2. `Add New` -> `Project`。
3. 选择你的 Git 仓库。
4. Root Directory 选择 `snake-leaderboard`。
5. 在 Environment Variables 中新增：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. 点击 Deploy。

## 6. 部署后验证
1. 打开你的网站地址。
2. 看右侧排行榜是否能正常加载。
3. 玩一局后输入 ID 并提交。
4. 刷新页面，确认成绩仍在。
5. 用另一个浏览器或无痕窗口打开，确认别人也能看到同一排行榜。

## 7. 常见问题
- 排行榜不显示：先检查 Vercel 环境变量是否填对。
- 提交失败：检查 Supabase 的 SQL 是否执行成功。
- 页面能打开但没数据：通常是 `scores` 表、RLS policy 或 `get_leaderboard` 没建好。

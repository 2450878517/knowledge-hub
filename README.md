# Knowledge Hub · 聊天室

基于 Node.js + Express + Socket.io 的实时聊天室应用。

## 功能

- 实时消息收发
- 在线成员列表
- 加入/离开系统通知
- 正在输入提示
- 响应式界面，支持移动端

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

开发模式（文件变更自动重启）：

```bash
npm dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)，输入昵称即可进入聊天室。可开多个浏览器标签页模拟多用户聊天。

## 项目结构

```
knowledge-hub/
├── server/
│   └── index.js      # Express + Socket.io 服务端
├── public/
│   ├── index.html    # 聊天界面
│   ├── css/style.css # 样式
│   └── js/app.js     # 客户端逻辑
└── package.json
```

## 技术栈

- **后端**: Node.js, Express, Socket.io
- **前端**: 原生 HTML / CSS / JavaScript

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |

## License

MIT

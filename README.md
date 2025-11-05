# Dream Mind - 智能思维导图

一个功能强大的在线思维导图工具，支持AI辅助、多种布局、实时协作等功能。

## ✨ 主要特性

### 🧠 AI智能助手
- **智能节点生成**：AI根据内容自动生成相关子节点
- **智能对话**：回答思维导图相关问题
- **内容识别**：根据关键词智能匹配建议

### 🎨 丰富的可视化
- **多种布局**：辐射图、树状图、鱼骨图、时间轴、组织架构
- **多种节点样式**：圆角矩形、圆形、菱形、云朵
- **5种主题**：默认、海洋、森林、日落、紫色

### ⚡ 高性能优化
- **视口裁剪**：只渲染可见区域，显著提升性能
- **智能布局**：自动选择最优布局方案
- **节流渲染**：优化渲染频率

### 🎯 便捷操作
- **右键菜单**：丰富的上下文操作
- **键盘导航**：完整的快捷键支持
- **拖拽操作**：直观的节点移动
- **双击编辑**：快速编辑节点内容

### 💾 数据管理
- **自动保存**：每10秒自动保存到本地
- **文件导入导出**：支持JSON格式
- **多格式导出**：PNG、JPG、SVG、PDF、文本大纲
- **历史记录**：撤销/重做功能

## 🚀 快速开始

1. **克隆项目**
```bash
git clone https://github.com/yourusername/dream-mind.git
cd dream-mind
```

2. **打开应用**
```bash
# 直接在浏览器中打开 index.html
# 或使用本地服务器
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 📖 使用说明

### 节点操作
- **选择节点**：右键点击节点确定选择
- **添加子节点**：选中节点后按 `N` 键或点击工具栏
- **编辑节点**：双击节点或按 `Enter` 键
- **删除节点**：选中节点后按 `Delete` 键

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Tab` | 切换节点选择 |
| `方向键` | 导航节点 |
| `Enter` | 编辑节点 |
| `Delete` | 删除节点 |
| `N` | 添加子节点 |
| `Ctrl+S` | 保存 |
| `Ctrl+Z/Y` | 撤销/重做 |
| `Ctrl+C/V` | 复制/粘贴 |

### AI助手使用
1. 点击右下角的AI助手按钮
2. 选择一个节点
3. 点击"扩展思路"、"整理结构"或"头脑风暴"
4. 或在聊天框中输入问题

## 🛠️ 技术栈

- **前端**：原生 JavaScript + HTML5 Canvas
- **样式**：CSS3 + 响应式设计
- **图标**：Font Awesome
- **导出**：jsPDF
- **存储**：LocalStorage + 文件系统

## 📁 项目结构

```
dream-mind/
├── index.html          # 主页面
├── mindmap.js          # 核心逻辑
├── style.css           # 样式文件
├── README.md           # 说明文档
└── examples/           # 示例文件
    └── mindmap.json    # 示例思维导图
```

## 🎯 核心功能

### 智能布局算法
- 根据节点数量自动选择最优布局
- 智能节点间距优化
- 自适应画布大小

### 性能优化
- 视口裁剪技术
- 节流渲染机制
- 内存管理优化

### 用户体验
- 直观的操作界面
- 丰富的视觉反馈
- 完善的错误处理

## 🔧 自定义配置

可以通过修改 `mindmap.js` 中的配置来自定义：

```javascript
// 主题配置
this.themes = {
    custom: { 
        primary: '#your-color', 
        secondary: '#your-color', 
        accent: '#your-color' 
    }
};

// 布局配置
this.layoutType = 'radial'; // radial, tree, fishbone, timeline, org
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Font Awesome](https://fontawesome.com/) - 图标库
- [jsPDF](https://github.com/parallax/jsPDF) - PDF导出
- 所有贡献者和用户的支持

## 📞 联系方式

- 项目链接: [https://github.com/yourusername/dream-mind](https://github.com/yourusername/dream-mind)
- 问题反馈: [Issues](https://github.com/yourusername/dream-mind/issues)

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
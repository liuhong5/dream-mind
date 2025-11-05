class MindMap {
    constructor() {
        this.canvas = document.getElementById('mindMap');
        this.ctx = this.canvas.getContext('2d');
        this.miniCanvas = document.getElementById('minimap');
        this.miniCtx = this.miniCanvas.getContext('2d');
        this.nodes = [];
        this.selectedNode = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.layoutType = 'radial';
        this.nodeStyle = 'rounded';
        this.currentTheme = 'default';
        this.history = [];
        this.historyIndex = -1;
        this.themes = {
            default: { primary: '#667eea', secondary: '#764ba2', accent: '#4CAF50' },
            ocean: { primary: '#2196F3', secondary: '#21CBF3', accent: '#00BCD4' },
            forest: { primary: '#4CAF50', secondary: '#8BC34A', accent: '#FF9800' },
            sunset: { primary: '#FF9800', secondary: '#FF5722', accent: '#E91E63' },
            purple: { primary: '#9C27B0', secondary: '#E91E63', accent: '#673AB7' }
        };
        
        this.connectionMode = false;
        this.connectingNode = null;
        this.particles = [];
        this.mousePos = null;
        this.audioContext = null;
        this.currentMusic = null;
        this.musicEnabled = false;
        this.customAudio = null;
        this.renderPending = false;
        this.hoveredNode = null;
        this.contextMenu = null;
        this.viewportBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.keyboardNavIndex = 0;
        
        this.init();
        this.bindEvents();
        this.createContextMenu();
        this.performanceMode = false;
        this.hoverCheckTime = 0;
        this.enableAutoSave();
        this.showAutoSaveIndicator();
    }

    init() {
        this.resizeCanvas();
        this.addRootNode();
        this.saveState();
        this.render();
        this.renderMinimap();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 60;
        this.miniCanvas.width = 200;
        this.miniCanvas.height = 150;
    }

    addRootNode() {
        const theme = this.themes[this.currentTheme];
        const rootNode = {
            id: Date.now(),
            text: '中心主题',
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            width: 120,
            height: 50,
            children: [],
            parent: null,
            level: 0,
            color: theme.primary,
            textColor: '#ffffff',
            fontSize: 16,
            style: this.nodeStyle
        };
        this.nodes.push(rootNode);
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
        this.canvas.addEventListener('mouseleave', () => { this.hoveredNode = null; this.throttledRender(); });
        
        document.getElementById('addNode').addEventListener('click', (e) => { e.stopPropagation(); this.addChildNode(); });
        document.getElementById('addSibling').addEventListener('click', (e) => { e.stopPropagation(); this.addSiblingNode(); });
        document.getElementById('deleteNode').addEventListener('click', (e) => { e.stopPropagation(); this.deleteSelectedNode(); });
        document.getElementById('layoutType').addEventListener('change', (e) => { e.stopPropagation(); this.changeLayout(e); });
        document.getElementById('nodeStyle').addEventListener('change', (e) => { e.stopPropagation(); this.changeNodeStyle(e); });
        document.getElementById('undo').addEventListener('click', (e) => { e.stopPropagation(); this.undo(); });
        document.getElementById('redo').addEventListener('click', (e) => { e.stopPropagation(); this.redo(); });
        document.getElementById('zoomIn').addEventListener('click', (e) => { e.stopPropagation(); this.zoom(1.2); });
        document.getElementById('zoomOut').addEventListener('click', (e) => { e.stopPropagation(); this.zoom(0.8); });
        document.getElementById('fitScreen').addEventListener('click', (e) => { e.stopPropagation(); this.fitToScreen(); });
        document.getElementById('save').addEventListener('click', (e) => { e.stopPropagation(); this.save(); });
        document.getElementById('load').addEventListener('click', (e) => { e.stopPropagation(); this.load(); });
        document.getElementById('export').addEventListener('click', (e) => { e.stopPropagation(); this.showExportModal(); });
        document.getElementById('clear').addEventListener('click', (e) => { e.stopPropagation(); this.clear(); });
        
        document.querySelectorAll('.theme-item').forEach(item => {
            item.addEventListener('click', (e) => { e.stopPropagation(); this.changeTheme(e.target.dataset.theme); });
        });
        
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.exportAs(e.currentTarget.dataset.format); });
        });
        
        document.getElementById('floatAdd').addEventListener('click', (e) => { e.stopPropagation(); this.addChildNode(); });
        document.getElementById('floatStyle').addEventListener('click', (e) => { e.stopPropagation(); this.toggleStylePanel(); });
        document.getElementById('floatConnect').addEventListener('click', (e) => { e.stopPropagation(); this.toggleConnectionMode(); });
        document.getElementById('floatNote').addEventListener('click', (e) => { e.stopPropagation(); this.addNote(); });
        document.getElementById('musicToggle').addEventListener('click', (e) => { e.stopPropagation(); this.toggleMusicPanel(); });
        document.getElementById('musicSelect').addEventListener('change', (e) => { e.stopPropagation(); this.changeMusic(e); });
        document.getElementById('customMusic').addEventListener('change', (e) => { e.stopPropagation(); this.loadCustomMusic(e); });
        document.getElementById('smartLayout').addEventListener('click', (e) => { e.stopPropagation(); this.applySmartLayout(); });
        document.getElementById('performanceToggle').addEventListener('click', (e) => { e.stopPropagation(); this.togglePerformanceMode(); });
        document.getElementById('aiAssistant').addEventListener('click', (e) => { e.stopPropagation(); this.toggleAI(); });
        
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        window.addEventListener('keydown', this.handleKeyboard.bind(this));
        document.addEventListener('click', (e) => {
            // 只隐藏右键菜单，绝不取消节点选择
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });
    }

    getNodeAt(x, y) {
        const adjustedX = (x - this.offset.x) / this.scale;
        const adjustedY = (y - this.offset.y) / this.scale;
        
        for (let node of this.nodes) {
            if (adjustedX >= node.x - node.width/2 && adjustedX <= node.x + node.width/2 &&
                adjustedY >= node.y - node.height/2 && adjustedY <= node.y + node.height/2) {
                return node;
            }
        }
        return null;
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const node = this.getNodeAt(x, y);
        
        if (this.connectionMode && node) {
            if (!this.connectingNode) {
                this.connectingNode = node;
            } else if (this.connectingNode !== node) {
                this.createConnection(this.connectingNode, node);
                this.connectingNode = null;
            }
            return;
        }
        
        if (node) {
            this.selectedNode = node;
            this.isDragging = true;
            this.dragOffset.x = (x - this.offset.x) / this.scale - node.x;
            this.dragOffset.y = (y - this.offset.y) / this.scale - node.y;
            this.createParticles(node.x, node.y);
            this.throttledRender();
        }
        // 点击空白区域什么都不做，保持当前选择
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.mousePos = { x: (x - this.offset.x) / this.scale, y: (y - this.offset.y) / this.scale };
        
        // 只在非拖拽状态下检测悬停
        if (!this.isDragging && (!this.hoverCheckTime || Date.now() - this.hoverCheckTime > 100)) {
            const hoveredNode = this.getNodeAt(x, y);
            if (hoveredNode !== this.hoveredNode) {
                this.hoveredNode = hoveredNode;
                this.canvas.style.cursor = hoveredNode ? 'pointer' : (this.connectionMode ? 'crosshair' : 'grab');
            }
            this.hoverCheckTime = Date.now();
        }
        
        if (this.isDragging && this.selectedNode) {
            this.selectedNode.x = (x - this.offset.x) / this.scale - this.dragOffset.x;
            this.selectedNode.y = (y - this.offset.y) / this.scale - this.dragOffset.y;
            this.throttledRender();
        }
        
        if (this.connectionMode) {
            this.throttledRender();
        }
    }

    onMouseUp() {
        this.isDragging = false;
        if (this.selectedNode) {
            this.saveState();
        }
        this.selectedNode = null;
    }

    onDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const node = this.getNodeAt(x, y);
        if (node) {
            this.editNode(node);
        }
    }

    onWheel(e) {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= scaleFactor;
        this.scale = Math.max(0.1, Math.min(3, this.scale));
        this.throttledRender();
    }

    editNode(node) {
        const input = document.createElement('input');
        input.className = 'node-input';
        input.value = node.text;
        input.style.left = (node.x * this.scale + this.offset.x - node.width/2) + 'px';
        input.style.top = (node.y * this.scale + this.offset.y - node.height/2) + 'px';
        input.style.width = node.width + 'px';
        
        document.body.appendChild(input);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            node.text = input.value || '新节点';
            node.width = Math.max(60, input.value.length * 12 + 20);
            document.body.removeChild(input);
            this.saveState();
            this.render();
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEdit();
        });
    }

    addChildNode() {
        if (this.nodes.length === 0) return;
        
        const parent = this.selectedNode || this.nodes[0];
        const theme = this.themes[this.currentTheme];
        const level = parent.level + 1;
        const colors = [theme.primary, theme.secondary, theme.accent];
        
        const newNode = {
            id: Date.now(),
            text: '新节点',
            x: parent.x + 150,
            y: parent.y,
            width: Math.max(80, 120 - level * 10),
            height: Math.max(30, 40 - level * 5),
            children: [],
            parent: parent.id,
            level: level,
            color: colors[level % colors.length],
            textColor: level === 0 ? '#ffffff' : '#333333',
            fontSize: Math.max(12, 16 - level * 2),
            style: this.nodeStyle
        };
        
        this.nodes.push(newNode);
        parent.children.push(newNode.id);
        this.saveState();
        this.applyLayout();
        this.render();
        this.renderMinimap();
    }

    drawNode(node) {
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        const x = node.x - node.width/2;
        const y = node.y - node.height/2;
        const w = node.width;
        const h = node.height;
        
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        this.ctx.fillStyle = node.color;
        this.ctx.beginPath();
        
        switch(node.style) {
            case 'circle':
                const radius = Math.min(w, h) / 2;
                this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                break;
            case 'diamond':
                this.ctx.moveTo(node.x, y);
                this.ctx.lineTo(x + w, node.y);
                this.ctx.lineTo(node.x, y + h);
                this.ctx.lineTo(x, node.y);
                this.ctx.closePath();
                break;
            case 'cloud':
                this.drawCloud(node.x, node.y, w, h);
                break;
            default:
                this.ctx.roundRect(x, y, w, h, 8);
        }
        
        this.ctx.fill();
        this.ctx.shadowColor = 'transparent';
        
        if (node === this.selectedNode) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 8;
        } else {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.lineWidth = 2;
        }
        this.ctx.stroke();
        
        this.ctx.fillStyle = node.textColor;
        this.ctx.font = `${node.fontSize}px Microsoft YaHei`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const lines = this.wrapText(node.text, w - 10);
        const lineHeight = node.fontSize + 2;
        const startY = node.y - (lines.length - 1) * lineHeight / 2;
        
        lines.forEach((line, i) => {
            this.ctx.fillText(line, node.x, startY + i * lineHeight);
        });
        
        this.ctx.restore();
    }
    
    drawConnection(parent, child) {
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        const gradient = this.ctx.createLinearGradient(parent.x, parent.y, child.x, child.y);
        gradient.addColorStop(0, parent.color);
        gradient.addColorStop(1, child.color);
        
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = Math.max(2, 6 - child.level);
        this.ctx.lineCap = 'round';
        
        const dx = child.x - parent.x;
        const dy = child.y - parent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(distance * 0.3, 100);
        
        this.ctx.beginPath();
        const cp1x = parent.x + curvature;
        const cp1y = parent.y;
        const cp2x = child.x - curvature;
        const cp2y = child.y;
        
        this.ctx.moveTo(parent.x, parent.y);
        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, child.x, child.y);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateViewportBounds();
        this.drawGrid();
        if (!this.performanceMode) {
            this.updateParticles();
            this.drawParticles();
        }
        
        // 视口裁剪优化 - 只渲染可见节点
        const visibleNodes = this.getVisibleNodes();
        
        for (let node of visibleNodes) {
            if (node.parent) {
                const parent = this.nodes.find(n => n.id === node.parent);
                if (parent && this.isNodeVisible(parent)) {
                    this.drawConnection(parent, node);
                }
            }
        }
        
        for (let node of visibleNodes) {
            this.drawNode(node);
            if (node.note) {
                this.drawNoteIcon(node);
            }
        }
        
        // 禁用悬停效果避免干扰选择
        // if (!this.performanceMode && this.hoveredNode && this.isNodeVisible(this.hoveredNode) && this.hoveredNode !== this.selectedNode) {
        //     this.drawHoverEffect(this.hoveredNode);
        // }
        
        if (this.connectionMode && this.connectingNode && this.mousePos) {
            this.ctx.save();
            this.ctx.strokeStyle = '#FF5722';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.connectingNode.x * this.scale + this.offset.x, this.connectingNode.y * this.scale + this.offset.y);
            this.ctx.lineTo(this.mousePos.x * this.scale + this.offset.x, this.mousePos.y * this.scale + this.offset.y);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }
    
    throttledRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.render();
                this.renderPending = false;
            });
        }
    }
    
    fastRender() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateViewportBounds();
        
        const visibleNodes = this.getVisibleNodes();
        
        // 优化连接线绘制
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let node of visibleNodes) {
            if (node.parent) {
                const parent = this.nodes.find(n => n.id === node.parent);
                if (parent && this.isNodeVisible(parent)) {
                    this.ctx.moveTo(parent.x * this.scale + this.offset.x, parent.y * this.scale + this.offset.y);
                    this.ctx.lineTo(node.x * this.scale + this.offset.x, node.y * this.scale + this.offset.y);
                }
            }
        }
        this.ctx.stroke();
        
        // 简化节点绘制
        for (let node of visibleNodes) {
            this.drawSimpleNode(node);
        }
    }
    
    drawSimpleNode(node) {
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        // 绘制节点背景
        this.ctx.fillStyle = node.color;
        this.ctx.beginPath();
        this.ctx.roundRect(node.x - node.width/2, node.y - node.height/2, node.width, node.height, 6);
        this.ctx.fill();
        
        // 选中状态边框
        if (node === this.selectedNode) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
        
        // 绘制文本
        this.ctx.fillStyle = node.textColor || '#ffffff';
        this.ctx.font = `${node.fontSize || 14}px Microsoft YaHei`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.text, node.x, node.y);
        
        this.ctx.restore();
    }
    
    // 键盘导航和快捷键
    handleKeyboard(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.save();
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        } else if (e.key === 'Delete' && this.selectedNode) {
            this.deleteSelectedNode();
        } else if (e.key === 'n' || e.key === 'N') {
            if (this.selectedNode) this.addChildNode();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.navigateNodes(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Enter' && this.selectedNode) {
            this.editNode(this.selectedNode);
        } else if (e.key === 'c' && e.ctrlKey) {
            e.preventDefault();
            this.copyNode();
        } else if (e.key === 'v' && e.ctrlKey) {
            e.preventDefault();
            this.pasteNode();
        } else if (e.key === 'Escape') {
            this.hideContextMenu();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            this.navigateWithArrows(e.key);
        }
    }
    
    // 搜索节点
    searchNodes(query) {
        const results = this.nodes.filter(node => 
            node.text.toLowerCase().includes(query.toLowerCase())
        );
        
        if (results.length > 0) {
            this.selectedNode = results[0];
            this.fitToNode(results[0]);
        }
        
        return results;
    }
    
    // 聚焦到节点
    fitToNode(node) {
        this.offset.x = this.canvas.width/2 - node.x * this.scale;
        this.offset.y = this.canvas.height/2 - node.y * this.scale;
        this.render();
    }
    
    // 自动保存
    enableAutoSave() {
        setInterval(() => {
            this.saveToLocalStorage();
            this.showAutoSaveIndicator();
        }, 10000); // 每10秒自动保存
    }
    
    // 显示自动保存指示器
    showAutoSaveIndicator() {
        const indicator = document.getElementById('autoSaveIndicator');
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
    
    // 本地存储保存
    saveToLocalStorage() {
        const data = {
            nodes: this.nodes,
            theme: this.currentTheme,
            layout: this.layoutType,
            style: this.nodeStyle,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('mindmap_autosave', JSON.stringify(data));
    }
    
    // 智能布局
    applySmartLayout() {
        if (this.nodes.length === 0) return;
        
        // 分析节点分布和关系
        const bounds = this.getNodesBounds();
        const nodeCount = this.nodes.length;
        const maxLevel = Math.max(...this.nodes.map(n => n.level));
        
        // 根据节点数量选择最优布局
        let optimalLayout = 'radial';
        if (nodeCount > 20) {
            optimalLayout = 'tree';
        } else if (maxLevel > 3) {
            optimalLayout = 'org';
        } else if (nodeCount < 8) {
            optimalLayout = 'fishbone';
        }
        
        // 应用布局
        this.layoutType = optimalLayout;
        document.getElementById('layoutType').value = optimalLayout;
        
        // 优化节点间距
        this.optimizeNodeSpacing();
        
        this.applyLayout();
        this.fitToScreen();
        this.render();
        this.renderMinimap();
        
        // 显示提示
        this.showNotification(`已应用智能布局: ${optimalLayout}`);
    }
    
    // 优化节点间距
    optimizeNodeSpacing() {
        const levels = {};
        this.nodes.forEach(node => {
            if (!levels[node.level]) levels[node.level] = [];
            levels[node.level].push(node);
        });
        
        // 根据层级调整节点大小
        Object.keys(levels).forEach(level => {
            const nodes = levels[level];
            const baseSize = level == 0 ? 120 : Math.max(80, 120 - level * 15);
            
            nodes.forEach(node => {
                node.width = Math.max(baseSize, node.text.length * 8 + 20);
                node.height = Math.max(30, 40 - level * 3);
            });
        });
    }
    
    // 切换性能模式
    togglePerformanceMode() {
        this.performanceMode = !this.performanceMode;
        const indicator = document.getElementById('performanceIndicator');
        const btn = document.getElementById('performanceToggle');
        
        if (this.performanceMode) {
            indicator.classList.add('active');
            btn.style.background = '#4CAF50';
            this.canvas.classList.add('viewport-optimized');
            this.showNotification('性能模式已开启');
        } else {
            indicator.classList.remove('active');
            btn.style.background = '#667eea';
            this.canvas.classList.remove('viewport-optimized');
            this.showNotification('性能模式已关闭');
        }
        this.throttledRender();
    }
    
    // 显示通知
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 2000;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    toggleAI() {
        const panel = document.getElementById('aiPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
    
    aiGenerate(type) {
        if (!this.selectedNode) {
            this.showNotification('请先选择一个节点');
            return;
        }
        
        const selectedText = this.selectedNode.text.toLowerCase();
        let suggestions = this.getSmartSuggestions(type, selectedText);
        
        suggestions.forEach((item, i) => {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            const newNode = {
                id: Date.now() + i,
                text: item,
                x: this.selectedNode.x + 150,
                y: this.selectedNode.y + (i - 1.5) * 60,
                width: Math.max(80, item.length * 8 + 20),
                height: 35,
                children: [],
                parent: this.selectedNode.id,
                level: this.selectedNode.level + 1,
                color: colors[i % colors.length],
                textColor: '#ffffff',
                fontSize: 13,
                style: this.nodeStyle
            };
            
            this.nodes.push(newNode);
            this.selectedNode.children.push(newNode.id);
        });
        
        this.throttledRender();
        this.saveState();
        this.showNotification(`AI已生成${suggestions.length}个建议`);
    }
    
    getSmartSuggestions(type, text) {
        const baseTemplates = {
            expand: ['目标定义', '实施步骤', '所需资源', '时间计划', '风险评估'],
            organize: ['高优先级', '中优先级', '低优先级', '紧急事项'],
            brainstorm: ['创新角度', '改进方案', '替代选择', '未来发展']
        };
        
        // 根据关键词智能匹配
        if (text.includes('项目') || text.includes('计划')) {
            return type === 'expand' ? ['项目目标', '任务分解', '团队分工', '进度跟踪', '质量控制'] :
                   type === 'organize' ? ['启动阶段', '执行阶段', '监控阶段', '收尾阶段'] :
                   ['敏捷开发', '瀑布式开发', '混合模式', '自动化测试'];
        }
        
        if (text.includes('学习') || text.includes('教育')) {
            return type === 'expand' ? ['学习目标', '学习方法', '学习资料', '学习计划', '效果评估'] :
                   type === 'organize' ? ['理论学习', '实践操作', '复习巩固', '测试评估'] :
                   ['在线学习', '线下培训', '同伴学习', '项目实战'];
        }
        
        if (text.includes('产品') || text.includes('设计')) {
            return type === 'expand' ? ['用户需求', '功能设计', '技术实现', '测试验证', '上线运营'] :
                   type === 'organize' ? ['需求分析', '原型设计', '开发实现', '测试优化'] :
                   ['用户中心设计', '数据驱动设计', 'AI辅助设计', '响应式设计'];
        }
        
        return baseTemplates[type] || baseTemplates.expand;
    }
    
    sendAI() {
        const input = document.getElementById('aiInput');
        const messages = document.getElementById('aiMessages');
        const question = input.value.trim();
        
        if (!question) return;
        
        messages.innerHTML += `<div class="user-msg">${question}</div>`;
        input.value = '';
        
        setTimeout(() => {
            let reply = this.getAIResponse(question);
            messages.innerHTML += `<div class="ai-msg"><i class="fas fa-robot"></i> ${reply}</div>`;
            messages.scrollTop = messages.scrollHeight;
        }, 800);
    }
    
    getAIResponse(question) {
        const q = question.toLowerCase();
        const nodeCount = this.nodes.length;
        const selectedText = this.selectedNode ? this.selectedNode.text : '无';
        
        // 智能分析问题类型
        if (q.includes('如何') || q.includes('怎么')) {
            if (q.includes('扩展') || q.includes('添加')) {
                return `对于"${selectedText}"，建议添加这些子节点：目标、方法、资源、时间表。点击上方"扩展思路"按钮让我帮你自动生成！`;
            }
            if (q.includes('组织') || q.includes('整理')) {
                return `当前有${nodeCount}个节点，建议按优先级分类：高优先级、中优先级、低优先级。使用不同颜色区分。`;
            }
            return '建议使用分层结构，从主题开始逐步细化。每个层级不超过7个子节点。';
        }
        
        if (q.includes('什么') || q.includes('是什么')) {
            if (this.selectedNode) {
                return `"${selectedText}"可以理解为一个核心概念。建议从定义、特点、作用、应用四个角度来展开。`;
            }
            return '请先选择一个节点，我可以帮你分析它的内容和含义。';
        }
        
        if (q.includes('为什么') || q.includes('原因')) {
            return '原因分析建议使用鱼骨图或因果关系图。从直接原因、根本原因、外部因素三个维度来分析。';
        }
        
        if (q.includes('优化') || q.includes('改进')) {
            if (nodeCount > 15) {
                return '节点较多，建议使用智能布局功能自动优化。也可以将相关节点合并或分组。';
            }
            return '建议检查节点层级是否合理，使用不同颜色区分主题，添加关键词和图标。';
        }
        
        if (q.includes('颜色') || q.includes('样式')) {
            return '建议使用主题色彩系统：主节点用深色，子节点用浅色。相关内容用相近色彩，重要内容用醒目色彩。';
        }
        
        if (q.includes('布局') || q.includes('结构')) {
            const layouts = ['辐射图适合头脑风暴', '树状图适合分类整理', '鱼骨图适合原因分析', '组织架构适合层级关系'];
            return `布局建议：${layouts.join('；')}。当前使用${this.layoutType}布局。`;
        }
        
        // 默认智能回复
        const tips = [
            '尝试使用关键词和短语，避免长句子',
            '每个分支不超过7个子节点，保持结构清晰',
            '使用颜色和图标增强视觉效果',
            '定期保存和备份你的思维导图',
            '可以使用右键菜单快速操作节点'
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }
    
    toggleStylePanel() {
        if (!this.selectedNode) {
            alert('请先选择一个节点');
            return;
        }
        
        const colors = ['#667eea', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        this.selectedNode.color = randomColor;
        this.render();
    }
    
    toggleMusicPanel() {
        const panel = document.getElementById('musicPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('音频上下文初始化失败');
        }
    }
    
    changeMusic(e) {
        const musicType = e.target.value;
        this.stopMusic();
        
        if (musicType !== 'none') {
            this.playMusic(musicType);
            this.musicEnabled = true;
            document.getElementById('musicToggle').innerHTML = '<i class="fas fa-volume-up"></i>';
            document.getElementById('musicToggle').style.background = '#4CAF50';
        } else {
            this.musicEnabled = false;
            document.getElementById('musicToggle').innerHTML = '<i class="fas fa-volume-mute"></i>';
            document.getElementById('musicToggle').style.background = '#667eea';
        }
    }
    
    playMusic(type) {
        if (!this.audioContext) {
            this.initAudio();
        }
        
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch(type) {
            case 'focus':
                oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
                oscillator.type = 'sine';
                break;
            case 'creative':
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                oscillator.type = 'triangle';
                break;
            case 'calm':
                oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
                oscillator.type = 'sine';
                break;
        }
        
        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
        oscillator.start();
        
        this.currentMusic = { oscillator, gainNode };
    }
    
    loadCustomMusic(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            this.stopMusic();
            
            this.customAudio = new Audio(url);
            this.customAudio.loop = true;
            this.customAudio.volume = 0.3;
            this.customAudio.play();
            
            this.musicEnabled = true;
            document.getElementById('musicToggle').innerHTML = '<i class="fas fa-volume-up"></i>';
            document.getElementById('musicToggle').style.background = '#4CAF50';
        }
    }
    
    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.oscillator.stop();
            this.currentMusic = null;
        }
        if (this.customAudio) {
            this.customAudio.pause();
            this.customAudio = null;
        }
    }
    
    toggleConnectionMode() {
        this.connectionMode = !this.connectionMode;
        const btn = document.getElementById('floatConnect');
        btn.style.background = this.connectionMode ? '#FF5722' : '#667eea';
        this.canvas.style.cursor = this.connectionMode ? 'crosshair' : 'grab';
    }
    
    addNote() {
        if (!this.selectedNode) {
            alert('请先选择一个节点');
            return;
        }
        const note = prompt('请输入备注:', this.selectedNode.note || '');
        if (note !== null) {
            this.selectedNode.note = note;
            this.render();
        }
    }
    
    createParticles(x, y) {
        if (!this.performanceMode) {
            for (let i = 0; i < 4; i++) {
                this.particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 1.0,
                    decay: 0.05
                });
            }
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            return particle.life > 0;
        });
    }
    
    drawParticles() {
        this.ctx.save();
        this.particles.forEach(particle => {
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
    
    drawNoteIcon(node) {
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        const iconX = node.x + node.width/2 - 8;
        const iconY = node.y - node.height/2 + 8;
        
        this.ctx.fillStyle = '#FFA726';
        this.ctx.beginPath();
        this.ctx.arc(iconX, iconY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('!', iconX, iconY + 3);
        
        this.ctx.restore();
    }
    
    createConnection(from, to) {
        if (from.id === to.id) return;
        
        if (to.parent) {
            const oldParent = this.nodes.find(n => n.id === to.parent);
            if (oldParent) {
                oldParent.children = oldParent.children.filter(id => id !== to.id);
            }
        }
        
        to.parent = from.id;
        to.level = from.level + 1;
        
        if (!from.children.includes(to.id)) {
            from.children.push(to.id);
        }
        
        const theme = this.themes[this.currentTheme];
        const colors = [theme.primary, theme.secondary, theme.accent];
        to.color = colors[to.level % colors.length];
        
        this.saveState();
        this.applyLayout();
        this.render();
        this.renderMinimap();
    }

    addSiblingNode() {
        if (!this.selectedNode || !this.selectedNode.parent) return;
        
        const parent = this.nodes.find(n => n.id === this.selectedNode.parent);
        if (!parent) return;
        
        const theme = this.themes[this.currentTheme];
        const level = this.selectedNode.level;
        const colors = [theme.primary, theme.secondary, theme.accent];
        
        const newNode = {
            id: Date.now(),
            text: '同级节点',
            x: this.selectedNode.x,
            y: this.selectedNode.y + 80,
            width: this.selectedNode.width,
            height: this.selectedNode.height,
            children: [],
            parent: parent.id,
            level: level,
            color: colors[level % colors.length],
            textColor: this.selectedNode.textColor,
            fontSize: this.selectedNode.fontSize,
            style: this.nodeStyle
        };
        
        this.nodes.push(newNode);
        parent.children.push(newNode.id);
        this.saveState();
        this.applyLayout();
        this.render();
        this.renderMinimap();
    }
    
    deleteSelectedNode() {
        if (!this.selectedNode || this.selectedNode.level === 0) return;
        
        const toDelete = [this.selectedNode.id];
        const findChildren = (nodeId) => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.children) {
                node.children.forEach(childId => {
                    toDelete.push(childId);
                    findChildren(childId);
                });
            }
        };
        findChildren(this.selectedNode.id);
        
        if (this.selectedNode.parent) {
            const parent = this.nodes.find(n => n.id === this.selectedNode.parent);
            if (parent) {
                parent.children = parent.children.filter(id => id !== this.selectedNode.id);
            }
        }
        
        this.nodes = this.nodes.filter(n => !toDelete.includes(n.id));
        this.clearSelection(); // 使用新方法
        this.saveState();
        this.render();
        this.renderMinimap();
    }
    
    changeLayout(e) {
        this.layoutType = e.target.value;
        this.applyLayout();
        this.render();
        this.renderMinimap();
    }
    
    changeNodeStyle(e) {
        this.nodeStyle = e.target.value;
        this.nodes.forEach(node => node.style = this.nodeStyle);
        this.render();
    }
    
    changeTheme(themeName) {
        this.currentTheme = themeName;
        document.querySelectorAll('.theme-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');
        
        const theme = this.themes[themeName];
        const colors = [theme.primary, theme.secondary, theme.accent];
        
        this.nodes.forEach(node => {
            node.color = colors[node.level % colors.length];
        });
        
        this.render();
        this.renderMinimap();
    }
    
    applyLayout() {
        if (this.nodes.length === 0) return;
        
        const root = this.nodes.find(n => n.level === 0);
        if (!root) return;
        
        switch(this.layoutType) {
            case 'tree':
                this.applyTreeLayout(root);
                break;
            case 'fishbone':
                this.applyFishboneLayout(root);
                break;
            case 'timeline':
                this.applyTimelineLayout(root);
                break;
            case 'org':
                this.applyOrgLayout(root);
                break;
            default:
                this.applyRadialLayout(root);
        }
    }
    
    applyRadialLayout(root) {
        const levels = {};
        this.nodes.forEach(node => {
            if (!levels[node.level]) levels[node.level] = [];
            levels[node.level].push(node);
        });
        
        Object.keys(levels).forEach(level => {
            const nodes = levels[level];
            if (level == 0) return;
            
            const angleStep = (Math.PI * 2) / nodes.length;
            const radius = 150 * level;
            
            nodes.forEach((node, index) => {
                const angle = angleStep * index;
                node.x = root.x + Math.cos(angle) * radius;
                node.y = root.y + Math.sin(angle) * radius;
            });
        });
    }
    
    applyTreeLayout(root) {
        const levelHeight = 100;
        const nodeSpacing = 120;
        
        const positionLevel = (nodes, level, startX) => {
            let currentX = startX;
            nodes.forEach(node => {
                node.x = currentX;
                node.y = root.y + level * levelHeight;
                
                const children = this.nodes.filter(n => n.parent === node.id);
                if (children.length > 0) {
                    positionLevel(children, level + 1, currentX - (children.length - 1) * nodeSpacing / 2);
                }
                currentX += nodeSpacing;
            });
        };
        
        const rootChildren = this.nodes.filter(n => n.parent === root.id);
        positionLevel(rootChildren, 1, root.x - (rootChildren.length - 1) * nodeSpacing / 2);
    }
    
    applyFishboneLayout(root) {
        const children = this.nodes.filter(n => n.parent === root.id);
        children.forEach((child, index) => {
            const side = index % 2 === 0 ? 1 : -1;
            const distance = 150 + Math.floor(index / 2) * 50;
            child.x = root.x + distance;
            child.y = root.y + side * (80 + Math.floor(index / 2) * 40);
        });
    }
    
    applyTimelineLayout(root) {
        const children = this.nodes.filter(n => n.parent === root.id);
        children.forEach((child, index) => {
            child.x = root.x + (index + 1) * 200;
            child.y = root.y;
        });
    }
    
    applyOrgLayout(root) {
        const children = this.nodes.filter(n => n.parent === root.id);
        const spacing = 150;
        const startX = root.x - (children.length - 1) * spacing / 2;
        
        children.forEach((child, index) => {
            child.x = startX + index * spacing;
            child.y = root.y + 100;
        });
    }
    
    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 50 * this.scale;
        const offsetX = this.offset.x % gridSize;
        const offsetY = this.offset.y % gridSize;
        
        for (let x = offsetX; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = offsetY; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    drawCloud(x, y, w, h) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(x - w/4, y - h/4, w/4, 0, Math.PI * 2);
        ctx.arc(x + w/4, y - h/4, w/3, 0, Math.PI * 2);
        ctx.arc(x + w/3, y + h/4, w/4, 0, Math.PI * 2);
        ctx.arc(x - w/3, y + h/4, w/3, 0, Math.PI * 2);
        ctx.arc(x, y, w/3, 0, Math.PI * 2);
    }
    
    wrapText(text, maxWidth) {
        const words = text.split('');
        const lines = [];
        let currentLine = '';
        
        for (let word of words) {
            const testLine = currentLine + word;
            const metrics = this.ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    }
    
    renderMinimap() {
        this.miniCtx.clearRect(0, 0, 200, 150);
        
        // 渐变背景
        const gradient = this.miniCtx.createLinearGradient(0, 0, 200, 150);
        gradient.addColorStop(0, '#fafbfc');
        gradient.addColorStop(1, '#f1f3f4');
        this.miniCtx.fillStyle = gradient;
        this.miniCtx.fillRect(0, 0, 200, 150);
        
        // 标题
        this.miniCtx.fillStyle = '#667eea';
        this.miniCtx.font = 'bold 10px Microsoft YaHei';
        this.miniCtx.textAlign = 'center';
        this.miniCtx.fillText('导航地图', 100, 12);
        
        if (this.nodes.length === 0) return;
        
        const bounds = this.getNodesBounds();
        const scaleX = 170 / (bounds.maxX - bounds.minX + 100);
        const scaleY = 115 / (bounds.maxY - bounds.minY + 100);
        const scale = Math.min(scaleX, scaleY, 0.3);
        
        this.miniCtx.save();
        this.miniCtx.translate(100, 80);
        this.miniCtx.scale(scale, scale);
        this.miniCtx.translate(-bounds.centerX, -bounds.centerY);
        
        // 绘制连接线
        this.nodes.forEach(node => {
            if (node.parent) {
                const parent = this.nodes.find(n => n.id === node.parent);
                if (parent) {
                    this.miniCtx.strokeStyle = '#888';
                    this.miniCtx.lineWidth = 1.2;
                    this.miniCtx.beginPath();
                    this.miniCtx.moveTo(parent.x, parent.y);
                    this.miniCtx.lineTo(node.x, node.y);
                    this.miniCtx.stroke();
                }
            }
        });
        
        // 绘制节点
        this.nodes.forEach(node => {
            if (node === this.selectedNode) {
                // 选中节点发光效果
                this.miniCtx.shadowColor = '#FFD700';
                this.miniCtx.shadowBlur = 6;
                this.miniCtx.fillStyle = '#FFD700';
                this.miniCtx.beginPath();
                this.miniCtx.arc(node.x, node.y, 3.5, 0, Math.PI * 2);
                this.miniCtx.fill();
                this.miniCtx.shadowBlur = 0;
                
                this.miniCtx.strokeStyle = '#FF8C00';
                this.miniCtx.lineWidth = 1.5;
                this.miniCtx.stroke();
            } else {
                this.miniCtx.fillStyle = node.color || '#667eea';
                this.miniCtx.beginPath();
                this.miniCtx.arc(node.x, node.y, 2, 0, Math.PI * 2);
                this.miniCtx.fill();
            }
        });
        
        // 绘制视口框
        const viewX = -this.offset.x / this.scale;
        const viewY = -this.offset.y / this.scale;
        const viewW = this.canvas.width / this.scale;
        const viewH = this.canvas.height / this.scale;
        
        this.miniCtx.strokeStyle = '#667eea';
        this.miniCtx.lineWidth = 1.5;
        this.miniCtx.globalAlpha = 0.8;
        this.miniCtx.setLineDash([3, 3]);
        this.miniCtx.strokeRect(viewX, viewY, viewW, viewH);
        this.miniCtx.setLineDash([]);
        this.miniCtx.globalAlpha = 1;
        
        this.miniCtx.restore();
        
        // 统计信息
        this.miniCtx.fillStyle = '#666';
        this.miniCtx.font = '9px Microsoft YaHei';
        this.miniCtx.textAlign = 'right';
        this.miniCtx.fillText(`节点: ${this.nodes.length}`, 190, 142);
    }
    
    getNodesBounds() {
        if (this.nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
        
        let minX = this.nodes[0].x, maxX = this.nodes[0].x;
        let minY = this.nodes[0].y, maxY = this.nodes[0].y;
        
        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x - node.width/2);
            maxX = Math.max(maxX, node.x + node.width/2);
            minY = Math.min(minY, node.y - node.height/2);
            maxY = Math.max(maxY, node.y + node.height/2);
        });
        
        return {
            minX, maxX, minY, maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    saveState() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(this.nodes));
        this.historyIndex++;
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.nodes = JSON.parse(this.history[this.historyIndex]);
            this.render();
            this.renderMinimap();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.nodes = JSON.parse(this.history[this.historyIndex]);
            this.render();
            this.renderMinimap();
        }
    }
    
    zoom(factor) {
        this.scale *= factor;
        this.scale = Math.max(0.1, Math.min(3, this.scale));
        this.render();
    }
    
    fitToScreen() {
        const bounds = this.getNodesBounds();
        const scaleX = (this.canvas.width - 100) / (bounds.maxX - bounds.minX);
        const scaleY = (this.canvas.height - 100) / (bounds.maxY - bounds.minY);
        this.scale = Math.min(scaleX, scaleY, 1);
        
        this.offset.x = this.canvas.width/2 - bounds.centerX * this.scale;
        this.offset.y = this.canvas.height/2 - bounds.centerY * this.scale;
        
        this.render();
    }
    
    showExportModal() {
        document.getElementById('exportModal').style.display = 'flex';
    }
    
    exportAs(format) {
        switch(format) {
            case 'png':
            case 'jpg':
                this.exportAsImage(format);
                break;
            case 'svg':
                this.exportAsSVG();
                break;
            case 'pdf':
                this.exportAsPDF();
                break;
            case 'json':
                this.exportAsJSON();
                break;
            case 'txt':
                this.exportAsText();
                break;
        }
        document.getElementById('exportModal').style.display = 'none';
    }
    
    exportAsImage(format) {
        const link = document.createElement('a');
        link.download = `mindmap.${format}`;
        link.href = this.canvas.toDataURL(`image/${format}`);
        link.click();
    }
    
    exportAsSVG() {
        let svg = `<svg width="${this.canvas.width}" height="${this.canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
        
        this.nodes.forEach(node => {
            if (node.parent) {
                const parent = this.nodes.find(n => n.id === node.parent);
                if (parent) {
                    svg += `<line x1="${parent.x}" y1="${parent.y}" x2="${node.x}" y2="${node.y}" stroke="#666" stroke-width="2"/>`;
                }
            }
            
            svg += `<rect x="${node.x - node.width/2}" y="${node.y - node.height/2}" width="${node.width}" height="${node.height}" fill="${node.color}" rx="8"/>`;
            svg += `<text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" fill="${node.textColor}" font-family="Microsoft YaHei" font-size="${node.fontSize}">${node.text}</text>`;
        });
        
        svg += '</svg>';
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.download = 'mindmap.svg';
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    
    exportAsPDF() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const imgData = this.canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
        pdf.save('mindmap.pdf');
    }
    
    exportAsJSON() {
        const data = {
            nodes: this.nodes,
            theme: this.currentTheme,
            layout: this.layoutType,
            style: this.nodeStyle
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = 'mindmap.json';
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    
    exportAsText() {
        let text = '思维导图大纲\n\n';
        
        const buildOutline = (nodeId, level = 0) => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            const indent = '  '.repeat(level);
            text += `${indent}${level === 0 ? '' : '- '}${node.text}\n`;
            
            const children = this.nodes.filter(n => n.parent === nodeId);
            children.forEach(child => buildOutline(child.id, level + 1));
        };
        
        const root = this.nodes.find(n => n.level === 0);
        if (root) buildOutline(root.id);
        
        const blob = new Blob([text], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = 'mindmap.txt';
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    
    save() {
        const data = {
            nodes: this.nodes,
            theme: this.currentTheme,
            layout: this.layoutType,
            style: this.nodeStyle
        };
        localStorage.setItem('mindmap', JSON.stringify(data));
        alert('保存成功！');
    }

    load() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        this.nodes = data.nodes || [];
                        this.currentTheme = data.theme || 'default';
                        this.layoutType = data.layout || 'radial';
                        this.nodeStyle = data.style || 'rounded';
                        
                        document.getElementById('layoutType').value = this.layoutType;
                        document.getElementById('nodeStyle').value = this.nodeStyle;
                        
                        this.render();
                        this.renderMinimap();
                        this.showNotification('文件加载成功！');
                    } catch (error) {
                        this.showNotification('文件格式错误！');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    clear() {
        if (confirm('确定要清空所有内容吗？')) {
            this.nodes = [];
            this.addRootNode();
            this.clearSelection(); // 清空时取消选择
            this.saveState();
            this.render();
            this.renderMinimap();
        }
    }
    
    // 创建右键菜单
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'context-menu';
        this.contextMenu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 8px 0;
            z-index: 2000;
            display: none;
            min-width: 150px;
        `;
        
        const menuItems = [
            { text: '添加子节点', icon: 'fas fa-plus', action: () => this.addChildNode() },
            { text: '添加同级节点', icon: 'fas fa-arrow-right', action: () => this.addSiblingNode() },
            { text: '编辑节点', icon: 'fas fa-edit', action: () => this.editNode(this.selectedNode) },
            { text: '删除节点', icon: 'fas fa-trash', action: () => this.deleteSelectedNode() },
            { text: '复制节点', icon: 'fas fa-copy', action: () => this.copyNode() },
            { text: '粘贴节点', icon: 'fas fa-paste', action: () => this.pasteNode() },
            { text: '更改颜色', icon: 'fas fa-palette', action: () => this.toggleStylePanel() },
            { text: '添加备注', icon: 'fas fa-sticky-note', action: () => this.addNote() },
            { text: '取消选择', icon: 'fas fa-times-circle', action: () => this.clearSelection() }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                transition: background 0.2s;
            `;
            menuItem.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                this.hideContextMenu();
            });
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#f0f0f0';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            this.contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(this.contextMenu);
    }
    
    // 显示右键菜单
    onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const node = this.getNodeAt(x, y);
        if (node) {
            this.selectedNode = node;
            this.contextMenu.style.left = e.clientX + 'px';
            this.contextMenu.style.top = e.clientY + 'px';
            this.contextMenu.style.display = 'block';
            this.render();
            
            // 显示节点确定提示
            this.showNodeSelectionTip(node);
        }
    }
    
    // 显示节点选择确定提示
    showNodeSelectionTip(node) {
        const tip = document.createElement('div');
        tip.style.cssText = `
            position: fixed;
            top: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            z-index: 2500;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(76, 175, 80, 0.3);
            animation: tipSlideIn 0.4s ease;
            border: 2px solid rgba(255,255,255,0.2);
        `;
        tip.innerHTML = `
            <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
            已确定选择节点: "${node.text}"
        `;
        
        document.body.appendChild(tip);
        
        setTimeout(() => {
            tip.style.animation = 'tipSlideOut 0.4s ease';
            setTimeout(() => {
                if (document.body.contains(tip)) {
                    document.body.removeChild(tip);
                }
            }, 400);
        }, 2500);
    }
    
    // 隐藏右键菜单
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }
    
    // 更新视口边界
    updateViewportBounds() {
        this.viewportBounds = {
            minX: -this.offset.x / this.scale,
            maxX: (this.canvas.width - this.offset.x) / this.scale,
            minY: -this.offset.y / this.scale,
            maxY: (this.canvas.height - this.offset.y) / this.scale
        };
    }
    
    // 检查节点是否在视口内
    isNodeVisible(node) {
        const margin = 50; // 额外边距
        return node.x + node.width/2 + margin >= this.viewportBounds.minX &&
               node.x - node.width/2 - margin <= this.viewportBounds.maxX &&
               node.y + node.height/2 + margin >= this.viewportBounds.minY &&
               node.y - node.height/2 - margin <= this.viewportBounds.maxY;
    }
    
    // 获取可见节点
    getVisibleNodes() {
        return this.nodes.filter(node => this.isNodeVisible(node));
    }
    
    // 绘制悬停效果
    drawHoverEffect(node) {
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        // 外发光效果
        this.ctx.shadowColor = node.color;
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = node.color;
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.6;
        
        const x = node.x - node.width/2 - 5;
        const y = node.y - node.height/2 - 5;
        const w = node.width + 10;
        const h = node.height + 10;
        
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 12);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    // 键盘导航
    navigateNodes(direction) {
        if (this.nodes.length === 0) return;
        
        this.keyboardNavIndex += direction;
        if (this.keyboardNavIndex < 0) this.keyboardNavIndex = this.nodes.length - 1;
        if (this.keyboardNavIndex >= this.nodes.length) this.keyboardNavIndex = 0;
        
        this.selectedNode = this.nodes[this.keyboardNavIndex];
        this.fitToNode(this.selectedNode);
        this.render();
    }
    
    // 方向键导航
    navigateWithArrows(key) {
        if (!this.selectedNode) {
            this.selectedNode = this.nodes[0];
            return;
        }
        
        let targetNode = null;
        const currentNode = this.selectedNode;
        
        switch(key) {
            case 'ArrowUp':
                if (currentNode.parent) {
                    targetNode = this.nodes.find(n => n.id === currentNode.parent);
                }
                break;
            case 'ArrowDown':
                if (currentNode.children.length > 0) {
                    targetNode = this.nodes.find(n => n.id === currentNode.children[0]);
                }
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                if (currentNode.parent) {
                    const parent = this.nodes.find(n => n.id === currentNode.parent);
                    if (parent) {
                        const siblings = parent.children.map(id => this.nodes.find(n => n.id === id));
                        const currentIndex = siblings.findIndex(n => n.id === currentNode.id);
                        const nextIndex = key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
                        if (nextIndex >= 0 && nextIndex < siblings.length) {
                            targetNode = siblings[nextIndex];
                        }
                    }
                }
                break;
        }
        
        if (targetNode) {
            this.selectedNode = targetNode;
            this.fitToNode(targetNode);
            this.render();
        }
    }
    
    // 复制节点
    copyNode() {
        if (this.selectedNode) {
            this.copiedNode = JSON.parse(JSON.stringify(this.selectedNode));
        }
    }
    
    // 只有特定操作才取消选择
    clearSelection() {
        this.selectedNode = null;
        this.throttledRender();
    }
    
    // 粘贴节点
    pasteNode() {
        if (this.copiedNode && this.selectedNode) {
            const newNode = JSON.parse(JSON.stringify(this.copiedNode));
            newNode.id = Date.now();
            newNode.text = newNode.text + ' (副本)';
            newNode.parent = this.selectedNode.id;
            newNode.level = this.selectedNode.level + 1;
            newNode.x = this.selectedNode.x + 150;
            newNode.y = this.selectedNode.y;
            newNode.children = [];
            
            this.nodes.push(newNode);
            this.selectedNode.children.push(newNode.id);
            this.saveState();
            this.applyLayout();
            this.render();
            this.renderMinimap();
        }
    }
    
    // 渲染优化 - 只在需要时重绘连接线
    renderConnections() {
        if (!this.performanceMode) {
            // 正常模式，绘制所有连接
            for (let node of this.nodes) {
                if (node.parent) {
                    const parent = this.nodes.find(n => n.id === node.parent);
                    if (parent) {
                        this.drawConnection(parent, node);
                    }
                }
            }
        } else {
            // 性能模式，只绘制可见连接
            const visibleNodes = this.getVisibleNodes();
            for (let node of visibleNodes) {
                if (node.parent) {
                    const parent = this.nodes.find(n => n.id === node.parent);
                    if (parent && this.isNodeVisible(parent)) {
                        this.drawConnection(parent, node);
                    }
                }
            }
        }
    }
}

function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

function searchNodes() {
    const query = document.getElementById('searchInput').value;
    if (query) {
        const results = mindMap.searchNodes(query);
        if (results.length === 0) {
            alert('未找到匹配的节点');
        }
    }
}

const mindMap = new MindMap();

// 显示使用说明
const showUsageGuide = () => {
    const guide = document.createElement('div');
    guide.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,249,250,0.95));
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        z-index: 3000;
        max-width: 400px;
        backdrop-filter: blur(15px);
        border: 2px solid #667eea;
    `;
    
    guide.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #667eea; margin: 0 0 10px 0;">
                <i class="fas fa-info-circle"></i> 节点选择说明
            </h3>
        </div>
        <div style="color: #333; line-height: 1.6; font-size: 14px;">
            <div style="margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4CAF50;">
                <strong style="color: #4CAF50;">🖱️ 右键点击节点</strong><br>
                <span style="color: #666;">右键点击任意节点即可确定选择该节点</span>
            </div>
            <div style="margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #2196F3;">
                <strong style="color: #2196F3;">🔒 选择锁定</strong><br>
                <span style="color: #666;">一旦选择节点，状态将保持不变</span>
            </div>
            <div style="margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #FF9800;">
                <strong style="color: #FF9800;">✨ 取消选择</strong><br>
                <span style="color: #666;">只能通过右键菜单"取消选择"来取消</span>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.parentElement.remove()" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            ">我知道了</button>
        </div>
    `;
    
    document.body.appendChild(guide);
    
    setTimeout(() => {
        if (document.body.contains(guide)) {
            guide.remove();
        }
    }, 8000);
};

setTimeout(showUsageGuide, 2000);

// 添加搜索功能
const searchDiv = document.createElement('div');
searchDiv.style.cssText = 'position: fixed; top: 70px; right: 20px; z-index: 1000; background: rgba(255,255,255,0.9); padding: 8px; border-radius: 8px; backdrop-filter: blur(10px);';
searchDiv.innerHTML = `
    <input type="text" id="searchInput" placeholder="搜索节点..." 
           style="padding: 6px; border: 1px solid #ddd; border-radius: 5px; width: 150px; font-size: 12px;">
    <button onclick="searchNodes()" style="padding: 6px 10px; margin-left: 5px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 12px;">搜索</button>
`;
document.body.appendChild(searchDiv);

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes tipSlideIn {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; scale: 0.8; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; scale: 1; }
    }
    @keyframes tipSlideOut {
        from { transform: translateX(-50%) translateY(0); opacity: 1; scale: 1; }
        to { transform: translateX(-50%) translateY(-20px); opacity: 0; scale: 0.8; }
    }
`;
document.head.appendChild(style);

// 检查是否有自动保存的数据
const autoSaveData = localStorage.getItem('mindmap_autosave');
if (autoSaveData) {
    try {
        const data = JSON.parse(autoSaveData);
        const saveTime = new Date(data.timestamp);
        const now = new Date();
        const diffMinutes = (now - saveTime) / (1000 * 60);
        
        if (diffMinutes < 60) { // 1小时内的自动保存
            if (confirm(`发现${Math.round(diffMinutes)}分钟前的自动保存，是否恢复？`)) {
                mindMap.nodes = data.nodes || [];
                mindMap.currentTheme = data.theme || 'default';
                mindMap.layoutType = data.layout || 'radial';
                mindMap.nodeStyle = data.style || 'rounded';
                
                document.getElementById('layoutType').value = mindMap.layoutType;
                document.getElementById('nodeStyle').value = mindMap.nodeStyle;
                
                mindMap.render();
                mindMap.renderMinimap();
            }
        }
    } catch (e) {
        console.log('自动保存数据解析失败');
    }
}

// 添加键盘导航提示
const keyboardHint = document.createElement('div');
keyboardHint.className = 'keyboard-hint';
keyboardHint.innerHTML = `
    <h4>⌨️ 快捷键</h4>
    <div><span>Tab</span><span>切换节点</span></div>
    <div><span>方向键</span><span>导航</span></div>
    <div><span>Enter</span><span>编辑</span></div>
    <div><span>Del</span><span>删除</span></div>
    <div><span>N</span><span>新节点</span></div>
    <div><span>Ctrl+S</span><span>保存</span></div>
    <div><span>Ctrl+Z</span><span>撤销</span></div>
`;
document.body.appendChild(keyboardHint);

// 点击隐藏提示
keyboardHint.addEventListener('click', () => {
    keyboardHint.style.opacity = keyboardHint.style.opacity === '0.5' ? '1' : '0.5';
});

// 双击完全隐藏
keyboardHint.addEventListener('dblclick', () => {
    keyboardHint.style.display = keyboardHint.style.display === 'none' ? 'block' : 'none';
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}
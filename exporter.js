document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('tree-container');
    const searchInput = document.getElementById('search-folder');

    // 1. 获取并渲染
    chrome.bookmarks.getTree((nodes) => {
        container.innerHTML = '';
        renderTree(nodes[0].children, container);
    });

    // 2. 递归渲染
    function renderTree(nodes, parentEl) {
        nodes.forEach(node => {
            if (node.children) {
                const div = document.createElement('div');
                div.className = 'tree-item';
                // 存储名称方便搜索
                div.setAttribute('data-name', (node.title || '').toLowerCase());
                
                const label = document.createElement('label');
                label.className = 'folder-label';
                label.innerHTML = `
                    <input type="checkbox" data-id="${node.id}" checked>
                    <span class="folder-name">📂 ${node.title || '未命名'}</span>
                `;
                
                const checkbox = label.querySelector('input');
                const subContainer = document.createElement('div');
                subContainer.style.paddingLeft = '22px';
                
                checkbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    subContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = isChecked);
                });

                div.appendChild(label);
                div.appendChild(subContainer);
                parentEl.appendChild(div);
                renderTree(node.children, subContainer);
            }
        });
    }

    // --- 搜索过滤逻辑 ---
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const items = container.querySelectorAll('.tree-item');
        
        items.forEach(item => {
            const name = item.getAttribute('data-name');
            if (name.includes(keyword)) {
                item.classList.remove('hidden');
            } else {
                // 如果父级不匹配，先隐藏，但如果子级匹配，逻辑会复杂点
                // 这里采用简单策略：关键词匹配则显示，不匹配则隐藏
                item.classList.add('hidden');
            }
        });
        
        // 修正：如果子节点匹配，需要确保其所有父节点也可见
        if (keyword !== '') {
            container.querySelectorAll('.tree-item:not(.hidden)').forEach(item => {
                let parent = item.parentElement.closest('.tree-item');
                while (parent) {
                    parent.classList.remove('hidden');
                    parent = parent.parentElement.closest('.tree-item');
                }
            });
        }
    });

    // 快捷按钮：仅勾选当前可见的
    document.getElementById('select-visible').onclick = () => {
        // 先全不选
        document.querySelectorAll('#tree-container input').forEach(cb => cb.checked = false);
        // 再勾选可见的
        document.querySelectorAll('.tree-item:not(.hidden) > .folder-label input').forEach(cb => cb.checked = true);
    };

    // 原有按钮逻辑
    document.getElementById('select-all').onclick = () => {
        document.querySelectorAll('#tree-container input').forEach(cb => cb.checked = true);
    };
    document.getElementById('select-none').onclick = () => {
        document.querySelectorAll('#tree-container input').forEach(cb => cb.checked = false);
    };

    // 3. 导出逻辑（沿用上一个版本的深度优先筛选）
    document.getElementById('export-btn').onclick = () => {
        const checkedIds = new Set(
            Array.from(document.querySelectorAll('#tree-container input:checked'))
                 .map(i => i.getAttribute('data-id'))
        );

        if (checkedIds.size === 0) return alert('请至少选择一个文件夹');

        chrome.bookmarks.getTree((nodes) => {
            const filteredData = nodes[0].children
                .map(rootNode => filterAndFormat(rootNode, checkedIds))
                .filter(Boolean);
            downloadData(filteredData);
        });
    };

    function filterAndFormat(node, checkedIds) {
        if (node.children) {
            if (checkedIds.has(node.id)) {
                return {
                    name: node.title || "未命名",
                    type: "folder",
                    children: node.children
                        .map(child => filterAndFormat(child, checkedIds))
                        .filter(Boolean)
                };
            }
            return null;
        } 
        return { name: node.title || "未命名", type: "bookmark", url: node.url };
    }

    function downloadData(data) {
        const content = `window.bookmarkData = ${JSON.stringify(data, null, 2)};`;
        const blob = new Blob([content], {type: 'text/javascript'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        a.click();
    }
});
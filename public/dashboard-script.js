// Dashboard专用脚本 - 不包含自动执行的checkAuth
// 这个文件被dashboard.html使用，所有函数都需要手动调用

let generatedCDKey = ''; // 存储生成的CDKey用于复制
let cdkeyCurrentPage = 1;
let cdkeyPageSize = 20;
let cdkeyTotal = 0;
let selectedCDKeyIds = new Set(); // 存储选中的CDKey ID
let cdkeyMap = new Map(); // 存储CDKey ID到code的映射

function getCDKeyFilters() {
    return {
        codeSearch: document.getElementById('cdkeySearch').value,
        status: document.getElementById('statusFilter').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };
}

function renderCDKeyPagination(total, page, pageSize) {
    const topPaginationDiv = document.getElementById('cdkey-pagination-top');
    const paginationDiv = document.getElementById('cdkey-pagination');
    const summaryDiv = document.getElementById('cdkey-pagination-summary');
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canGoPrev = page > 1;
    const canGoNext = page < totalPages;

    if (total === 0) {
        summaryDiv.textContent = '共 0 条';
        if (topPaginationDiv) topPaginationDiv.innerHTML = '';
        paginationDiv.innerHTML = '';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    summaryDiv.textContent = `显示 ${start}-${end} 条，共 ${total} 条`;

    const paginationMarkup = `
        <div class="text-sm text-on-surface-variant">
            第 ${page} / ${totalPages} 页
        </div>
        <div class="flex items-center gap-2">
            <button
                type="button"
                ${canGoPrev ? `onclick="goToCDKeyPage(${page - 1})"` : ''}
                class="px-4 py-2 rounded-lg text-sm border border-outline-variant ${canGoPrev ? 'bg-surface-container text-on-surface hover:bg-surface-container-high' : 'bg-surface-container-low text-on-surface-variant cursor-not-allowed'}"
                ${canGoPrev ? '' : 'disabled'}
            >
                上一页
            </button>
            <button
                type="button"
                ${canGoNext ? `onclick="goToCDKeyPage(${page + 1})"` : ''}
                class="px-4 py-2 rounded-lg text-sm border border-outline-variant ${canGoNext ? 'bg-surface-container text-on-surface hover:bg-surface-container-high' : 'bg-surface-container-low text-on-surface-variant cursor-not-allowed'}"
                ${canGoNext ? '' : 'disabled'}
            >
                下一页
            </button>
        </div>
    `;

    if (topPaginationDiv) {
        topPaginationDiv.innerHTML = paginationMarkup;
    }
    paginationDiv.innerHTML = paginationMarkup;
}

function changeCDKeyPageSize() {
    const pageSizeSelect = document.getElementById('cdkeyPageSize');
    cdkeyPageSize = parseInt(pageSizeSelect.value, 10) || 20;
    cdkeyCurrentPage = 1;
    loadAllCDKeys();
}

function applyCDKeyFilters() {
    cdkeyCurrentPage = 1;
    loadAllCDKeys();
}

function goToCDKeyPage(page) {
    const totalPages = Math.max(1, Math.ceil(cdkeyTotal / cdkeyPageSize));
    if (page < 1 || page > totalPages || page === cdkeyCurrentPage) {
        return;
    }

    cdkeyCurrentPage = page;
    loadAllCDKeys();
}

// 登出
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login-new.html';
    } catch (error) {
        console.error('登出失败:', error);
        alert('登出失败');
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        // 更新KPI卡片（管理和历史页面）
        document.getElementById('totalKeys').textContent = stats.total;
        document.getElementById('availableKeys').textContent = stats.available;
        document.getElementById('usedKeys').textContent = stats.used;
        document.getElementById('totalRequests').textContent = stats.totalRequests;

        // 更新请求页欢迎栏中的数据
        const requestTotal = document.getElementById('requestTotalKeys');
        const requestAvailable = document.getElementById('requestAvailableKeys');
        const requestUsed = document.getElementById('requestUsedKeys');
        const requestRequests = document.getElementById('requestTotalRequests');

        if (requestTotal) requestTotal.textContent = stats.total;
        if (requestAvailable) requestAvailable.textContent = stats.available;
        if (requestUsed) requestUsed.textContent = stats.used;
        if (requestRequests) requestRequests.textContent = stats.totalRequests;
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 请求CDKey
async function requestCDKey() {
    const reason = document.getElementById('reason').value.trim();

    if (!reason) {
        alert('请输入请求原因');
        return;
    }

    const submitBtn = document.querySelector('#keyRequestForm button[type="submit"]');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span><span>处理中...</span>';

    try {
        const response = await fetch('/api/get-cdkey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
            generatedCDKey = data.cdkey;
            document.getElementById('newlyGeneratedKey').textContent = data.cdkey;
            document.getElementById('reason').value = '';

            // 显示模态窗口
            showSuccessModal();

            // 刷新数据
            loadStats();
            loadRecentHistory();
            if (window.currentUser) {
                checkAuth(); // 刷新配额
            }
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (error) {
        alert('❌ 请求失败，请检查服务器连接');
        console.error('请求CDKey失败:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
    }
}

// 显示成功模态窗口
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    const modalContent = document.getElementById('modalContent');

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modalContent.classList.add('scale-100');
        modalContent.classList.remove('scale-95');
    }, 10);
}

// 关闭成功模态窗口
function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    const modalContent = document.getElementById('modalContent');

    modal.classList.remove('opacity-100');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// 复制到剪贴板
function copyToClipboard() {
    const icon = document.getElementById('copyIcon');

    if (navigator.clipboard && generatedCDKey) {
        navigator.clipboard.writeText(generatedCDKey).then(() => {
            icon.textContent = 'done';
            setTimeout(() => {
                icon.textContent = 'content_copy';
            }, 1500);
        }).catch(() => {
            // 降级方案
            fallbackCopyToClipboard(generatedCDKey);
        });
    } else {
        fallbackCopyToClipboard(generatedCDKey);
    }
}

// 降级复制方案
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
        const icon = document.getElementById('copyIcon');
        icon.textContent = 'done';
        setTimeout(() => {
            icon.textContent = 'content_copy';
        }, 1500);
    } catch (err) {
        console.error('复制失败:', err);
    }

    document.body.removeChild(textArea);
}

// 加载最近历史预览
async function loadRecentHistory() {
    try {
        const response = await fetch('/api/history?limit=3');
        const history = await response.json();

        const previewDiv = document.getElementById('recent-history-preview');

        if (history.length === 0) {
            previewDiv.innerHTML = '<p class="text-center text-on-surface-variant py-10 text-sm">暂无历史记录</p>';
            return;
        }

        previewDiv.innerHTML = history.map(item => `
            <div class="hover:bg-surface-container-low transition-colors group p-5 flex items-center justify-between">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <div class="font-mono font-bold bg-surface-container-high px-3 py-1.5 rounded text-sm text-on-surface select-all">
                            ${item.cdkey_code}
                        </div>
                        <button onclick="quickCopy('${item.cdkey_code}', this)" class="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded transition-all active:scale-90" title="复制">
                            <span class="material-symbols-outlined text-[16px] text-primary">content_copy</span>
                        </button>
                    </div>
                    ${item.username ? `<div class="text-primary font-semibold text-sm">${item.username}</div>` : ''}
                    <div class="flex-1 min-w-0">
                        <p class="text-on-surface-variant text-sm truncate">${item.reason}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="text-on-surface-variant text-sm whitespace-nowrap">${formatDate(item.requested_at)}</span>
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700">已分配</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载最近历史失败:', error);
        document.getElementById('recent-history-preview').innerHTML = '<p class="text-center text-error py-10 text-sm">加载失败</p>';
    }
}

// 快速复制
function quickCopy(text, button) {
    const icon = button.querySelector('.material-symbols-outlined');
    const originalIcon = icon.textContent;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            icon.textContent = 'done';
            setTimeout(() => icon.textContent = originalIcon, 1500);
        });
    } else {
        icon.textContent = 'done';
        setTimeout(() => icon.textContent = originalIcon, 1500);
    }
}

// 添加单个CDKey
async function addSingleCDKey() {
    const code = document.getElementById('singleCDKey').value.trim();
    if (!code) {
        alert('请输入CDKey');
        return;
    }

    try {
        const response = await fetch('/api/add-cdkey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const data = await response.json();
        if (data.success) {
            alert('✅ CDKey添加成功');
            document.getElementById('singleCDKey').value = '';
            loadStats();
        } else {
            alert(`❌ 添加失败: ${data.error}`);
        }
    } catch (error) {
        alert('❌ 添加失败，请检查服务器连接');
        console.error('添加CDKey失败:', error);
    }
}

// 批量添加CDKey
async function addBatchCDKeys() {
    const batchText = document.getElementById('batchCDKeys').value.trim();
    if (!batchText) {
        alert('请输入CDKey列表');
        return;
    }

    const codes = batchText.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (codes.length === 0) {
        alert('没有有效的CDKey');
        return;
    }

    try {
        const response = await fetch('/api/add-batch-cdkeys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes })
        });

        const data = await response.json();
        if (data.success) {
            alert(`✅ 成功添加 ${data.count} 个CDKey`);
            document.getElementById('batchCDKeys').value = '';
            loadStats();
        } else {
            alert(`❌ 添加失败: ${data.message}`);
        }
    } catch (error) {
        alert('❌ 添加失败，请检查服务器连接');
        console.error('批量添加CDKey失败:', error);
    }
}

// 处理CSV上传
async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        alert('请选择CSV文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);

            if (lines.length === 0) {
                alert('CSV文件为空');
                return;
            }

            // 解析CSV头部
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const codeIndex = headers.indexOf('code');

            if (codeIndex === -1) {
                alert('CSV文件中未找到code列');
                return;
            }

            // 提取所有code值
            const codes = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values[codeIndex]) {
                    const code = values[codeIndex].trim();
                    if (code) {
                        codes.push(code);
                    }
                }
            }

            if (codes.length === 0) {
                alert('CSV中没有有效的CDKey');
                return;
            }

            // 确认导入
            if (!confirm(`准备导入 ${codes.length} 个CDKey，是否继续？`)) {
                return;
            }

            // 批量添加
            const response = await fetch('/api/add-batch-cdkeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codes })
            });

            const data = await response.json();
            if (data.success) {
                alert(`✅ 成功从CSV导入 ${data.count} 个CDKey`);
                loadStats();
                if (typeof loadAllCDKeys === 'function') {
                    loadAllCDKeys();
                }
            } else {
                alert(`❌ 导入失败: ${data.message}`);
            }
        } catch (error) {
            alert('❌ CSV解析失败，请检查文件格式');
            console.error('CSV解析错误:', error);
        }

        // 清空文件选择
        event.target.value = '';
    };

    reader.onerror = () => {
        alert('❌ 文件读取失败');
        event.target.value = '';
    };

    reader.readAsText(file);
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 加载所有CDKey列表
async function loadAllCDKeys(page = cdkeyCurrentPage) {
    try {
        const { codeSearch, status, startDate, endDate } = getCDKeyFilters();
        const listDiv = document.getElementById('cdkey-list');
        const pageSizeSelect = document.getElementById('cdkeyPageSize');
        if (pageSizeSelect) {
            pageSizeSelect.value = String(cdkeyPageSize);
        }

        cdkeyCurrentPage = Math.max(1, page);
        const offset = (cdkeyCurrentPage - 1) * cdkeyPageSize;

        let url = `/api/cdkeys?limit=${cdkeyPageSize}&offset=${offset}`;
        if (codeSearch) url += `&codeSearch=${encodeURIComponent(codeSearch)}`;
        if (status) url += `&status=${status}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const response = await fetch(url);
        const data = await response.json();
        const cdkeys = Array.isArray(data) ? data : (data.items || []);
        cdkeyTotal = Array.isArray(data) ? cdkeys.length : (data.total || 0);

        // 更新cdkeyMap
        cdkeys.forEach(key => {
            cdkeyMap.set(key.id, key.code);
        });

        const totalPages = Math.max(1, Math.ceil(cdkeyTotal / cdkeyPageSize));
        if (cdkeyCurrentPage > totalPages) {
            cdkeyCurrentPage = totalPages;
            return loadAllCDKeys(cdkeyCurrentPage);
        }

        if (cdkeys.length === 0) {
            listDiv.innerHTML = '<p class="text-center text-on-surface-variant py-10">没有找到匹配的CDKey</p>';
            renderCDKeyPagination(cdkeyTotal, cdkeyCurrentPage, cdkeyPageSize);
            updateBatchDeleteButton();
            return;
        }

        listDiv.innerHTML = `
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-high">
                        <th class="p-3 text-center border-b-2 border-outline-variant w-12">
                            <input type="checkbox" id="selectAllCDKeys" onchange="toggleSelectAll()" class="w-4 h-4 cursor-pointer">
                        </th>
                        <th class="p-3 text-left border-b-2 border-outline-variant">ID</th>
                        <th class="p-3 text-left border-b-2 border-outline-variant">CDKey</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">状态</th>
                        <th class="p-3 text-left border-b-2 border-outline-variant">创建时间</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${cdkeys.map(key => `
                        <tr class="border-b border-outline-variant hover:bg-surface-container-low">
                            <td class="p-3 text-center">
                                <input type="checkbox" class="cdkey-checkbox w-4 h-4 cursor-pointer" data-id="${key.id}" onchange="toggleCDKeySelection(${key.id})">
                            </td>
                            <td class="p-3">${key.id}</td>
                            <td class="p-3 font-mono font-bold">
                                <span class="select-all">${key.code}</span>
                                <button onclick="copySingleCDKey('${key.code}', this)" class="ml-2 p-1 hover:bg-primary/10 rounded transition-all" title="复制">
                                    <span class="material-symbols-outlined text-[18px] text-primary">content_copy</span>
                                </button>
                            </td>
                            <td class="p-3 text-center">
                                ${key.is_used ? '<span class="text-error">已使用</span>' : '<span class="text-success">可用</span>'}
                            </td>
                            <td class="p-3">${formatDate(key.created_at)}</td>
                            <td class="p-3 text-center">
                                <button onclick="deleteCDKey(${key.id})" class="px-3 py-1 bg-error text-white rounded hover:bg-error/90">删除</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        renderCDKeyPagination(cdkeyTotal, cdkeyCurrentPage, cdkeyPageSize);

        // 恢复选中状态
        restoreCheckboxStates();
        updateBatchDeleteButton();
    } catch (error) {
        console.error('加载CDKey列表失败:', error);
    }
}

function resetCDKeyFilters() {
    document.getElementById('cdkeySearch').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    cdkeyCurrentPage = 1;
    loadAllCDKeys();
}

async function exportCDKeys() {
    const codeSearch = document.getElementById('cdkeySearch').value;
    const status = document.getElementById('statusFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let url = '/api/export/cdkeys?';
    if (codeSearch) url += `&codeSearch=${encodeURIComponent(codeSearch)}`;
    if (status) url += `&status=${status}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    window.location.href = url;
}

async function deleteCDKey(id) {
    if (!confirm('确定要删除这个CDKey吗？')) return;

    try {
        const response = await fetch(`/api/cdkey/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            alert('✅ CDKey已删除');
            selectedCDKeyIds.delete(id); // 从选中列表中移除
            loadAllCDKeys(cdkeyCurrentPage);
            loadStats();
        } else {
            alert('❌ 删除失败: ' + data.error);
        }
    } catch (error) {
        alert('❌ 删除失败，请检查服务器连接');
        console.error('删除CDKey失败:', error);
    }
}

// 切换单个CDKey选中状态
function toggleCDKeySelection(id) {
    const checkbox = document.querySelector(`.cdkey-checkbox[data-id="${id}"]`);
    if (checkbox && checkbox.checked) {
        selectedCDKeyIds.add(id);
    } else {
        selectedCDKeyIds.delete(id);
    }
    updateSelectAllCheckbox();
    updateBatchDeleteButton();
}

// 全选/取消全选
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCDKeys');
    const checkboxes = document.querySelectorAll('.cdkey-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const id = parseInt(checkbox.dataset.id);
        if (selectAllCheckbox.checked) {
            selectedCDKeyIds.add(id);
        } else {
            selectedCDKeyIds.delete(id);
        }
    });

    updateBatchDeleteButton();
}

// 更新全选复选框状态
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCDKeys');
    const checkboxes = document.querySelectorAll('.cdkey-checkbox');

    if (!checkboxes.length) {
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
}

// 恢复复选框状态
function restoreCheckboxStates() {
    selectedCDKeyIds.forEach(id => {
        const checkbox = document.querySelector(`.cdkey-checkbox[data-id="${id}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    updateSelectAllCheckbox();
}

// 更新批量删除按钮状态
function updateBatchDeleteButton() {
    const deleteButton = document.getElementById('batchDeleteBtn');
    const copyButton = document.getElementById('batchCopyBtn');
    const count = selectedCDKeyIds.size;

    if (deleteButton) {
        if (count > 0) {
            deleteButton.disabled = false;
            deleteButton.textContent = `批量删除 (${count})`;
            deleteButton.className = 'px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 transition-colors';
        } else {
            deleteButton.disabled = true;
            deleteButton.textContent = '批量删除';
            deleteButton.className = 'px-4 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm cursor-not-allowed';
        }
    }

    if (copyButton) {
        if (count > 0) {
            copyButton.disabled = false;
            copyButton.textContent = `批量复制 (${count})`;
            copyButton.className = 'px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors';
        } else {
            copyButton.disabled = true;
            copyButton.textContent = '批量复制';
            copyButton.className = 'px-4 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm cursor-not-allowed';
        }
    }
}

// 批量删除CDKey
async function batchDeleteCDKeys() {
    if (selectedCDKeyIds.size === 0) {
        alert('请先选择要删除的CDKey');
        return;
    }

    if (!confirm(`确定要删除选中的 ${selectedCDKeyIds.size} 个CDKey吗？此操作不可恢复！`)) {
        return;
    }

    const button = document.getElementById('batchDeleteBtn');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '删除中...';

    try {
        const response = await fetch('/api/cdkeys/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedCDKeyIds) })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ 成功删除 ${data.count} 个CDKey`);
            selectedCDKeyIds.clear();
            loadAllCDKeys(cdkeyCurrentPage);
            loadStats();
        } else {
            alert('❌ 批量删除失败: ' + (data.message || data.error));
        }
    } catch (error) {
        alert('❌ 批量删除失败，请检查服务器连接');
        console.error('批量删除CDKey失败:', error);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        updateBatchDeleteButton();
    }
}

// 复制单个CDKey
function copySingleCDKey(code, button) {
    const icon = button.querySelector('.material-symbols-outlined');
    const originalIcon = icon.textContent;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            icon.textContent = 'done';
            setTimeout(() => icon.textContent = originalIcon, 1500);
        }).catch(() => {
            fallbackCopy(code);
            icon.textContent = 'done';
            setTimeout(() => icon.textContent = originalIcon, 1500);
        });
    } else {
        fallbackCopy(code);
        icon.textContent = 'done';
        setTimeout(() => icon.textContent = originalIcon, 1500);
    }
}

// 批量复制CDKey
async function batchCopyCDKeys() {
    if (selectedCDKeyIds.size === 0) {
        alert('请先选择要复制的CDKey');
        return;
    }

    const button = document.getElementById('batchCopyBtn');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '复制中...';

    try {
        // 收集所有选中的CDKey code
        const codes = [];
        for (const id of selectedCDKeyIds) {
            const code = cdkeyMap.get(id);
            if (code) {
                codes.push(code);
            }
        }

        if (codes.length === 0) {
            alert('❌ 未找到要复制的CDKey');
            return;
        }

        // 复制到剪贴板（每行一个）
        const text = codes.join('\n');

        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert(`✅ 已复制 ${codes.length} 个CDKey到剪贴板`);
        } else {
            fallbackCopy(text);
            alert(`✅ 已复制 ${codes.length} 个CDKey到剪贴板`);
        }
    } catch (error) {
        alert('❌ 复制失败');
        console.error('批量复制CDKey失败:', error);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// 降级复制方案
function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('复制失败:', err);
    }

    document.body.removeChild(textArea);
}

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        const listDiv = document.getElementById('user-list');
        if (users.length === 0) {
            listDiv.innerHTML = '<p class="text-center text-on-surface-variant py-10">暂无用户</p>';
            return;
        }

        listDiv.innerHTML = `
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-high">
                        <th class="p-3 text-left border-b-2 border-outline-variant">用户名</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">角色</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">每日配额</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">每月配额</th>
                        <th class="p-3 text-center border-b-2 border-outline-variant">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr class="border-b border-outline-variant hover:bg-surface-container-low">
                            <td class="p-3 font-bold">${user.username}</td>
                            <td class="p-3 text-center">
                                <span class="px-3 py-1 rounded-full text-white text-sm ${user.role === 'admin' ? 'bg-primary' : 'bg-outline'}">
                                    ${user.role === 'admin' ? '管理员' : '普通用户'}
                                </span>
                            </td>
                            <td class="p-3 text-center">${user.daily_quota}</td>
                            <td class="p-3 text-center">${user.monthly_quota}</td>
                            <td class="p-3 text-center">
                                <button onclick="editUserQuota(${user.id}, '${user.username}', ${user.daily_quota}, ${user.monthly_quota})"
                                        class="px-3 py-1 bg-primary text-white rounded hover:bg-primary-container">
                                    编辑配额
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}

async function editUserQuota(userId, username, currentDaily, currentMonthly) {
    const dailyQuota = prompt(`设置用户 "${username}" 的每日配额:`, currentDaily);
    if (dailyQuota === null) return;

    const monthlyQuota = prompt(`设置用户 "${username}" 的每月配额:`, currentMonthly);
    if (monthlyQuota === null) return;

    try {
        const response = await fetch(`/api/users/${userId}/quota`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dailyQuota: parseInt(dailyQuota),
                monthlyQuota: parseInt(monthlyQuota)
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('✅ 配额更新成功');
            loadUsers();
        } else {
            alert('❌ 更新失败: ' + data.message);
        }
    } catch (error) {
        alert('❌ 更新失败，请检查服务器连接');
        console.error('更新配额失败:', error);
    }
}

// 加载请求历史
async function loadHistory() {
    try {
        const cdkeySearch = document.getElementById('historyCdkeySearch').value;
        const reasonSearch = document.getElementById('historyReasonSearch').value;
        const usernameSearch = window.currentUser && window.currentUser.role === 'admin' ? document.getElementById('historyUsernameSearch').value : '';
        const startDate = document.getElementById('historyStartDate').value;
        const endDate = document.getElementById('historyEndDate').value;

        let url = '/api/history?limit=50';
        if (cdkeySearch) url += `&cdkeySearch=${encodeURIComponent(cdkeySearch)}`;
        if (reasonSearch) url += `&reasonSearch=${encodeURIComponent(reasonSearch)}`;
        if (usernameSearch) url += `&usernameSearch=${encodeURIComponent(usernameSearch)}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const response = await fetch(url);
        const history = await response.json();

        const historyList = document.getElementById('history-list');
        if (history.length === 0) {
            historyList.innerHTML = '<p class="text-center text-on-surface-variant py-10">没有找到匹配的请求历史</p>';
            return;
        }

        historyList.innerHTML = history.map(item => `
            <div class="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
                ${item.username ? `<div class="text-primary font-bold mb-2">👤 ${item.username}</div>` : ''}
                <div class="font-mono font-bold text-lg mb-1 flex items-center gap-2">
                    <span>🔑 <span class="select-all">${item.cdkey_code}</span></span>
                    <button onclick="quickCopy('${item.cdkey_code}', this)" class="p-1 hover:bg-primary/10 rounded transition-all" title="复制">
                        <span class="material-symbols-outlined text-[18px] text-primary">content_copy</span>
                    </button>
                </div>
                <div class="text-on-surface-variant mb-1">📝 ${item.reason}</div>
                <div class="text-sm text-outline">⏰ ${formatDate(item.requested_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载历史失败:', error);
        document.getElementById('history-list').innerHTML = '<p class="text-error">加载失败</p>';
    }
}

function resetHistoryFilters() {
    document.getElementById('historyCdkeySearch').value = '';
    document.getElementById('historyReasonSearch').value = '';
    if (window.currentUser && window.currentUser.role === 'admin') {
        document.getElementById('historyUsernameSearch').value = '';
    }
    document.getElementById('historyStartDate').value = '';
    document.getElementById('historyEndDate').value = '';
    loadHistory();
}

async function exportHistory() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        alert('仅管理员可以导出数据');
        return;
    }

    const cdkeySearch = document.getElementById('historyCdkeySearch').value;
    const reasonSearch = document.getElementById('historyReasonSearch').value;
    const usernameSearch = document.getElementById('historyUsernameSearch').value;
    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;

    let url = '/api/export/history?';
    if (cdkeySearch) url += `&cdkeySearch=${encodeURIComponent(cdkeySearch)}`;
    if (reasonSearch) url += `&reasonSearch=${encodeURIComponent(reasonSearch)}`;
    if (usernameSearch) url += `&usernameSearch=${encodeURIComponent(usernameSearch)}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    window.location.href = url;
}

async function clearAllData() {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：这将删除所有CDKey和请求历史记录！')) return;

    try {
        const response = await fetch('/api/clear-all', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ 所有数据已清空');
            loadStats();
            loadHistory();
        } else {
            alert('❌ 清空失败');
        }
    } catch (error) {
        alert('❌ 操作失败，请检查服务器连接');
        console.error('清空数据失败:', error);
    }
}

// ==================== 数据分析功能 ====================

let charts = {}; // 存储图表实例

// 加载所有分析数据
async function loadAnalytics() {
    const days = parseInt(document.getElementById('timeRangeSelector').value);

    try {
        // 并行加载所有数据
        const [health, timeseries, ranking, hourly, weekday, insights, anomalous, activity] = await Promise.all([
            fetch('/api/analytics/health').then(r => r.json()),
            fetch(`/api/analytics/timeseries?days=${days}`).then(r => r.json()),
            fetch('/api/analytics/users/ranking?limit=10').then(r => r.json()),
            fetch('/api/analytics/hourly').then(r => r.json()),
            fetch('/api/analytics/weekday').then(r => r.json()),
            fetch('/api/analytics/insights').then(r => r.json()),
            fetch('/api/analytics/anomalous-users').then(r => r.json()),
            fetch('/api/analytics/user-activity').then(r => r.json())
        ]);

        // 更新智能洞察
        renderInsights(insights);

        // 更新库存健康度
        renderInventoryHealth(health);

        // 渲染所有图表
        renderTrendChart(timeseries);
        renderRequestChart(timeseries);
        renderUserRankingChart(ranking);
        renderHourlyChart(hourly);
        renderWeekdayChart(weekday);

        // 渲染异常用户检测
        renderAnomalousUsers(anomalous);

        // 渲染用户活跃度
        renderUserActivity(activity);

    } catch (error) {
        console.error('加载分析数据失败:', error);
        alert('❌ 加载分析数据失败，请检查服务器连接');
    }
}

// 渲染智能洞察
function renderInsights(insights) {
    const container = document.getElementById('insightsContainer');

    if (insights.length === 0) {
        container.innerHTML = '<div class="text-center text-on-surface-variant py-4">暂无洞察</div>';
        return;
    }

    const typeStyles = {
        danger: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-orange-50 border-orange-200 text-orange-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        success: 'bg-green-50 border-green-200 text-green-800'
    };

    container.innerHTML = insights.map(insight => `
        <div class="flex items-start gap-3 p-4 rounded-lg border-2 ${typeStyles[insight.type]}">
            <span class="text-2xl flex-shrink-0">${insight.icon}</span>
            <p class="flex-1 font-medium">${insight.message}</p>
        </div>
    `).join('');
}

// 渲染库存健康度
function renderInventoryHealth(health) {
    document.getElementById('healthCurrentStock').textContent = health.available;
    document.getElementById('healthDailyConsumption').textContent = health.avgDailyRequests.toFixed(1);
    document.getElementById('healthDaysLeft').textContent = health.daysRemaining;

    // 计算建议补充量（补充到60天）
    const targetDays = 60;
    const suggestedAmount = Math.max(0, Math.ceil((targetDays - health.daysRemaining) * health.avgDailyRequests));
    document.getElementById('healthSuggestedAmount').textContent = suggestedAmount;

    // 更新状态徽章
    const statusBadge = document.getElementById('healthStatusBadge');
    if (health.status === 'critical') {
        statusBadge.textContent = '危险';
        statusBadge.className = 'px-4 py-2 rounded-full text-sm font-bold bg-red-500 text-white';
    } else if (health.status === 'warning') {
        statusBadge.textContent = '警告';
        statusBadge.className = 'px-4 py-2 rounded-full text-sm font-bold bg-orange-500 text-white';
    } else {
        statusBadge.textContent = '健康';
        statusBadge.className = 'px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white';
    }

    // 更新进度条
    const percentage = Math.min(100, (health.daysRemaining / targetDays) * 100);
    const progressBar = document.getElementById('healthProgressBar');
    const percentageText = document.getElementById('healthPercentage');

    progressBar.style.width = percentage + '%';
    percentageText.textContent = percentage.toFixed(0) + '%';

    // 根据状态改变进度条颜色
    if (health.status === 'critical') {
        progressBar.className = 'h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500';
    } else if (health.status === 'warning') {
        progressBar.className = 'h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500';
    } else {
        progressBar.className = 'h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500';
    }
}

// 渲染异常用户检测
function renderAnomalousUsers(data) {
    const container = document.getElementById('anomalousUsersContent');

    if (data.users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6">
                <span class="material-symbols-outlined text-green-500 text-5xl mb-2">check_circle</span>
                <p class="text-green-700 font-semibold">未检测到异常用户</p>
                <p class="text-sm text-on-surface-variant mt-2">所有用户申请行为正常</p>
            </div>
        `;
        return;
    }

    const riskColors = {
        high: 'bg-red-100 text-red-800',
        warning: 'bg-orange-100 text-orange-800',
        normal: 'bg-green-100 text-green-800'
    };

    const riskIcons = {
        high: '🔴',
        warning: '🟡',
        normal: '🟢'
    };

    const riskLabels = {
        high: '高风险',
        warning: '注意',
        normal: '正常'
    };

    container.innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="border-b-2 border-outline-variant">
                    <th class="text-left py-3 px-2">用户名</th>
                    <th class="text-center py-3 px-2">申请次数</th>
                    <th class="text-center py-3 px-2">vs 平均值</th>
                    <th class="text-center py-3 px-2">风险等级</th>
                </tr>
            </thead>
            <tbody>
                ${data.users.map(user => `
                    <tr class="border-b border-outline-variant hover:bg-surface-container-low">
                        <td class="py-3 px-2 font-bold">${user.username}</td>
                        <td class="text-center py-3 px-2">${user.count} 次</td>
                        <td class="text-center py-3 px-2 font-bold text-orange-600">↑ ${user.ratio}x</td>
                        <td class="text-center py-3 px-2">
                            <span class="px-3 py-1 rounded-full text-xs font-bold ${riskColors[user.riskLevel]}">
                                ${riskIcons[user.riskLevel]} ${riskLabels[user.riskLevel]}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="mt-4 p-3 bg-surface-container-lowest rounded-lg">
            <p class="text-sm text-on-surface-variant">
                <strong>平均值：</strong>${data.avgRequests.toFixed(2)} 次/周
            </p>
            <p class="text-xs text-on-surface-variant mt-2">
                📌 检测规则：超过平均值 3 倍标记为注意，5 倍标记为高风险
            </p>
        </div>
    `;
}

// 渲染用户活跃度
function renderUserActivity(data) {
    document.getElementById('activityThisWeek').textContent = data.thisWeek;
    document.getElementById('activityThisMonth').textContent = data.thisMonth;
    document.getElementById('activityTotal').textContent = data.totalUsers;
    document.getElementById('activityRate').textContent = data.activeRate;

    const rateBar = document.getElementById('activityRateBar');
    rateBar.style.width = data.activeRate + '%';

    const growthText = document.getElementById('activityGrowth');
    if (data.growthRate > 0) {
        growthText.innerHTML = `<span class="text-green-600">↑ ${data.growthRate}%</span>`;
    } else if (data.growthRate < 0) {
        growthText.innerHTML = `<span class="text-red-600">↓ ${Math.abs(data.growthRate)}%</span>`;
    } else {
        growthText.innerHTML = '<span class="text-on-surface-variant">持平</span>';
    }
}

// 切换使用规律分析区域
function toggleUsagePatterns() {
    const content = document.getElementById('usagePatternsContent');
    const icon = document.getElementById('usagePatternsIcon');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

// 切换趋势图Tab
function switchTrendTab(tab) {
    const inventoryBtn = document.getElementById('inventoryTabBtn');
    const requestBtn = document.getElementById('requestTabBtn');
    const inventoryContent = document.getElementById('inventoryTrendContent');
    const requestContent = document.getElementById('requestTrendContent');
    const icon = document.getElementById('trendTabIcon');

    if (tab === 'inventory') {
        // 激活库存趋势
        inventoryBtn.className = 'px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white transition-all';
        requestBtn.className = 'px-4 py-2 rounded-md text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all';
        inventoryContent.classList.remove('hidden');
        requestContent.classList.add('hidden');
        icon.textContent = 'show_chart';

        // 重新调整图表大小
        if (charts.trend) charts.trend.resize();
    } else {
        // 激活请求量趋势
        requestBtn.className = 'px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white transition-all';
        inventoryBtn.className = 'px-4 py-2 rounded-md text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all';
        requestContent.classList.remove('hidden');
        inventoryContent.classList.add('hidden');
        icon.textContent = 'bar_chart';

        // 重新调整图表大小
        if (charts.request) charts.request.resize();
    }
}

// 渲染库存趋势图
function renderTrendChart(data) {
    const chartDom = document.getElementById('trendChart');
    if (charts.trend) {
        charts.trend.dispose();
    }
    charts.trend = echarts.init(chartDom);

    // 计算预测线（基于最近7天的趋势）
    const recentData = data.availableKeys.slice(-7);
    const avgDecline = recentData.length > 1 ?
        (recentData[0] - recentData[recentData.length - 1]) / (recentData.length - 1) : 0;

    const predictDays = 14;
    const predictData = [];
    let lastValue = data.availableKeys[data.availableKeys.length - 1];

    for (let i = 0; i < predictDays; i++) {
        lastValue = Math.max(0, lastValue - avgDecline);
        predictData.push(lastValue.toFixed(0));
    }

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        legend: {
            data: ['总量', '可用', '已使用', '预测'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: [
                ...data.dates.map(d => d.substring(5)),
                ...Array.from({length: predictDays}, (_, i) => `+${i+1}天`)
            ]
        },
        yAxis: {
            type: 'value'
        },
        series: [
            {
                name: '总量',
                type: 'line',
                data: [...data.totalKeys, ...new Array(predictDays).fill(null)],
                smooth: true,
                lineStyle: { width: 2 },
                itemStyle: { color: '#3b82f6' }
            },
            {
                name: '可用',
                type: 'line',
                data: [...data.availableKeys, ...new Array(predictDays).fill(null)],
                smooth: true,
                lineStyle: { width: 3 },
                itemStyle: { color: '#10b981' },
                areaStyle: { opacity: 0.3 }
            },
            {
                name: '已使用',
                type: 'line',
                data: [...data.usedKeys, ...new Array(predictDays).fill(null)],
                smooth: true,
                lineStyle: { width: 2 },
                itemStyle: { color: '#f59e0b' }
            },
            {
                name: '预测',
                type: 'line',
                data: [...new Array(data.dates.length).fill(null), ...predictData],
                smooth: true,
                lineStyle: {
                    width: 2,
                    type: 'dashed',
                    color: '#10b981'
                },
                itemStyle: { color: '#10b981' }
            }
        ]
    };

    charts.trend.setOption(option);
}

// 渲染请求量趋势图
function renderRequestChart(data) {
    const chartDom = document.getElementById('requestChart');
    if (charts.request) {
        charts.request.dispose();
    }
    charts.request = echarts.init(chartDom);

    // 计算7天移动平均线
    const movingAvg = [];
    const window = 7;
    for (let i = 0; i < data.requests.length; i++) {
        if (i < window - 1) {
            movingAvg.push(null);
        } else {
            const sum = data.requests.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
            movingAvg.push((sum / window).toFixed(1));
        }
    }

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: {
            data: ['请求数', '7日均线'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: data.dates.map(d => d.substring(5))
        },
        yAxis: {
            type: 'value'
        },
        series: [
            {
                name: '请求数',
                type: 'bar',
                data: data.requests,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#8b5cf6' },
                        { offset: 1, color: '#6366f1' }
                    ])
                },
                emphasis: {
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#7c3aed' },
                            { offset: 1, color: '#4f46e5' }
                        ])
                    }
                }
            },
            {
                name: '7日均线',
                type: 'line',
                data: movingAvg,
                smooth: true,
                lineStyle: { width: 2, color: '#ef4444' },
                itemStyle: { color: '#ef4444' },
                symbol: 'circle',
                symbolSize: 6
            }
        ]
    };

    charts.request.setOption(option);
}

// 渲染用户排行榜
function renderUserRankingChart(data) {
    const chartDom = document.getElementById('userRankingChart');
    if (charts.ranking) {
        charts.ranking.dispose();
    }
    charts.ranking = echarts.init(chartDom);

    if (data.length === 0) {
        charts.ranking.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'center',
                textStyle: { color: '#999', fontSize: 16 }
            }
        });
        return;
    }

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value'
        },
        yAxis: {
            type: 'category',
            data: data.map(d => d.username).reverse(),
            axisLabel: {
                interval: 0
            }
        },
        series: [
            {
                name: '请求次数',
                type: 'bar',
                data: data.map(d => d.count).reverse(),
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#3953bd' },
                        { offset: 1, color: '#667eea' }
                    ])
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}次'
                }
            }
        ]
    };

    charts.ranking.setOption(option);
}

// 渲染时段分布图
function renderHourlyChart(data) {
    const chartDom = document.getElementById('hourlyChart');
    if (charts.hourly) {
        charts.hourly.dispose();
    }
    charts.hourly = echarts.init(chartDom);

    const hours = Array.from({length: 24}, (_, i) => `${i}:00`);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            left: '5%',
            right: '5%',
            bottom: '10%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: hours,
            axisLabel: {
                rotate: 45,
                interval: 1,
                fontSize: 10
            }
        },
        yAxis: {
            type: 'value'
        },
        series: [
            {
                name: '请求数',
                type: 'bar',
                data: data,
                itemStyle: {
                    color: (params) => {
                        const hour = params.dataIndex;
                        if (hour >= 9 && hour < 18) return '#3b82f6'; // 工作时间
                        if (hour >= 18 && hour < 22) return '#f59e0b'; // 晚上
                        return '#94a3b8'; // 深夜/凌晨
                    }
                }
            }
        ]
    };

    charts.hourly.setOption(option);
}

// 渲染星期分布图
function renderWeekdayChart(data) {
    const chartDom = document.getElementById('weekdayChart');
    if (charts.weekday) {
        charts.weekday.dispose();
    }
    charts.weekday = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            left: '5%',
            right: '5%',
            bottom: '5%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: data.labels
        },
        yAxis: {
            type: 'value'
        },
        series: [
            {
                name: '请求数',
                type: 'bar',
                data: data.data,
                itemStyle: {
                    color: (params) => {
                        const day = params.dataIndex;
                        // 周末用不同颜色
                        return (day === 0 || day === 6) ? '#f59e0b' : '#3b82f6';
                    }
                },
                label: {
                    show: true,
                    position: 'top'
                }
            }
        ]
    };

    charts.weekday.setOption(option);
}

// 响应式调整图表大小
window.addEventListener('resize', () => {
    Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
    });
});

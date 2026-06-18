// Dashboard专用脚本 - 不包含自动执行的checkAuth
// 这个文件被dashboard.html使用，所有函数都需要手动调用

let generatedCDKey = ''; // 存储生成的CDKey用于复制
let cdkeyCurrentPage = 1;
let cdkeyPageSize = 20;
let cdkeyTotal = 0;

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

    if (reason.length < 10) {
        alert('请提供更详细的说明（至少10个字符）');
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

        const totalPages = Math.max(1, Math.ceil(cdkeyTotal / cdkeyPageSize));
        if (cdkeyCurrentPage > totalPages) {
            cdkeyCurrentPage = totalPages;
            return loadAllCDKeys(cdkeyCurrentPage);
        }

        if (cdkeys.length === 0) {
            listDiv.innerHTML = '<p class="text-center text-on-surface-variant py-10">没有找到匹配的CDKey</p>';
            renderCDKeyPagination(cdkeyTotal, cdkeyCurrentPage, cdkeyPageSize);
            return;
        }

        listDiv.innerHTML = `
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-high">
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
                            <td class="p-3">${key.id}</td>
                            <td class="p-3 font-mono font-bold">${key.code}</td>
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
                ${window.currentUser && window.currentUser.role === 'admin' && item.username ? `<div class="text-primary font-bold mb-2">👤 ${item.username}</div>` : ''}
                <div class="font-mono font-bold text-lg mb-1">🔑 ${item.cdkey_code}</div>
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

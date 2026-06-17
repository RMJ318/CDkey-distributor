// 当前用户信息
let currentUser = null;

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadStats();
});

// 检查登录状态
async function checkAuth() {
    try {
        const response = await fetch('/api/current-user');
        const data = await response.json();

        if (!data.success) {
            window.location.href = '/login.html';
            return;
        }

        currentUser = data.user;

        // 显示用户信息
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '普通用户';

        // 如果是管理员，显示管理面板
        if (currentUser.role === 'admin') {
            document.getElementById('manageTab').style.display = 'block';
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
        window.location.href = '/login.html';
    }
}

// 登出
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('登出失败:', error);
        alert('登出失败');
    }
}

// 切换Tab
function switchTab(tabName) {
    // 移除所有active类
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

    // 添加active类
    event.target.classList.add('active');
    document.getElementById(`${tabName}-panel`).classList.add('active');

    // 如果切换到历史面板，加载历史
    if (tabName === 'history') {
        loadHistory();
    }

    // 如果切换到管理面板，加载CDKey列表
    if (tabName === 'manage') {
        loadAllCDKeys();
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        document.getElementById('totalKeys').textContent = stats.total;
        document.getElementById('availableKeys').textContent = stats.available;
        document.getElementById('usedKeys').textContent = stats.used;
        document.getElementById('totalRequests').textContent = stats.totalRequests;
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 请求CDKey
async function requestCDKey() {
    const reason = document.getElementById('reason').value.trim();
    const resultDiv = document.getElementById('result');

    if (!reason) {
        showResult('请输入请求原因', 'error');
        return;
    }

    try {
        const response = await fetch('/api/get-cdkey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
            showResult(
                `<div>✅ ${data.message}</div>
                 <div class="cdkey-display">${data.cdkey}</div>
                 <div style="text-align: center; color: #666;">请妥善保存此CDKey</div>`,
                'success'
            );
            document.getElementById('reason').value = '';
            loadStats(); // 刷新统计
        } else {
            showResult(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showResult('❌ 请求失败，请检查服务器连接', 'error');
        console.error('请求CDKey失败:', error);
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
            headers: {
                'Content-Type': 'application/json'
            },
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
            headers: {
                'Content-Type': 'application/json'
            },
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

// 加载请求历史
async function loadHistory() {
    try {
        const response = await fetch('/api/history?limit=50');
        const history = await response.json();

        const historyList = document.getElementById('history-list');

        if (history.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无请求历史</p>';
            return;
        }

        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="cdkey">🔑 ${item.cdkey_code}</div>
                <div class="reason">📝 ${item.reason}</div>
                <div class="time">⏰ ${formatDate(item.requested_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载历史失败:', error);
        document.getElementById('history-list').innerHTML = '<p style="color: red;">加载失败</p>';
    }
}

// 清空所有数据
async function clearAllData() {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) {
        return;
    }

    if (!confirm('再次确认：这将删除所有CDKey和请求历史记录！')) {
        return;
    }

    try {
        const response = await fetch('/api/clear-all', {
            method: 'POST'
        });

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

// 显示结果
function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = message;
    resultDiv.className = `result ${type}`;
    resultDiv.classList.remove('hidden');
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

// 加载所有CDKey列表（管理员）
async function loadAllCDKeys() {
    try {
        const response = await fetch('/api/cdkeys?limit=100');
        const cdkeys = await response.json();

        const listDiv = document.getElementById('cdkey-list');

        if (cdkeys.length === 0) {
            listDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无CDKey</p>';
            return;
        }

        listDiv.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">ID</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">CDKey</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">状态</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">创建时间</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${cdkeys.map(key => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">${key.id}</td>
                            <td style="padding: 12px; font-family: monospace; font-weight: bold;">${key.code}</td>
                            <td style="padding: 12px; text-align: center;">
                                ${key.is_used ? '<span style="color: #dc3545;">已使用</span>' : '<span style="color: #28a745;">可用</span>'}
                            </td>
                            <td style="padding: 12px;">${formatDate(key.created_at)}</td>
                            <td style="padding: 12px; text-align: center;">
                                <button onclick="deleteCDKey(${key.id})" class="btn btn-danger" style="padding: 6px 12px; font-size: 0.9em;">删除</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('加载CDKey列表失败:', error);
    }
}

// 删除CDKey
async function deleteCDKey(id) {
    if (!confirm('确定要删除这个CDKey吗？')) {
        return;
    }

    try {
        const response = await fetch(`/api/cdkey/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ CDKey已删除');
            loadAllCDKeys();
            loadStats();
        } else {
            alert('❌ 删除失败: ' + data.error);
        }
    } catch (error) {
        alert('❌ 删除失败，请检查服务器连接');
        console.error('删除CDKey失败:', error);
    }
}

// Enter键提交
document.getElementById('reason').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        requestCDKey();
    }
});

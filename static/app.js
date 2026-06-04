// API 基础地址（前后端分离部署时修改为后端地址，如 "http://localhost:8080"）
// 同源部署时留空字符串即可
const API_BASE = "";

// ===== 全局状态 =====
let currentPath = "/";
let selectedFile = null;
let selectedFiles = []; // 多选文件列表
let lastSelectedIndex = -1; // 上次选中的索引，用于 Shift 范围选
let clipboard = { action: null, sourcePaths: [] };
let sortField = "name";
let sortOrder = "asc";
let navHistory = ["/"];
let navIndex = 0;
let currentImageList = [];
let currentImageIndex = -1;
let isSearching = false; // 是否处于搜索状态
let searchQuery = ""; // 当前搜索关键词
let currentUser = null; // 当前登录用户
let currentTheme = localStorage.getItem('theme') || 'light'; // 当前主题
let authToken = localStorage.getItem('authToken') || ''; // 认证令牌
let serverInfoCache = null; // 服务器信息缓存（IP地址等）
let audioPlaylist = []; // 音频播放列表
let currentAudioIndex = -1; // 当前播放的音频索引
let audioPlayMode = 'sequential'; // 播放模式: sequential(顺序), random(随机), loop(循环)

// 音频文件扩展名
const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"];

// 拖选相关变量
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragSelectionBox = null;

// 可编辑文件扩展名
const EDITABLE_EXTENSIONS = [
    "txt", "html", "htm", "css", "js", "ts", "json", "xml", "csv",
    "py", "java", "go", "c", "cpp", "h", "hpp", "cs", "rs", "swift",
    "php", "rb", "sql", "sh", "bash", "zsh", "bat", "ps1",
    "yml", "yaml", "toml", "ini", "cfg", "conf", "env", "properties",
    "log", "diff", "patch", "vue", "jsx", "tsx", "svelte",
    "scss", "sass", "less", "r", "lua", "pl", "ex", "exs", "erl",
    "clj", "hs", "ml", "fs", "dart", "kt", "scala", "vim", "elisp",
    "md", "markdown"
];

const EDITABLE_FILENAMES = [
    "dockerfile", "makefile", "gemfile", "rakefile", "procfile",
    "gitignore", "env", "editorconfig", "eslintrc", "prettierrc",
    "babelrc", "npmrc", "bowerrc"
];

// ===== 工具函数 =====
function isEditableFile(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes(".")) {
        const ext = lowerName.split(".").pop();
        return EDITABLE_EXTENSIONS.includes(ext);
    }
    return EDITABLE_FILENAMES.includes(lowerName);
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 604800000) return Math.floor(diff / 86400000) + " 天前";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    if (year === now.getFullYear()) {
        return month + "-" + day + " " + hours + ":" + minutes;
    }
    return year + "-" + month + "-" + day;
}

function getFileIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const iconMap = {
        "pdf": "fa-file-pdf",
        "doc": "fa-file-word", "docx": "fa-file-word",
        "xls": "fa-file-excel", "xlsx": "fa-file-excel",
        "ppt": "fa-file-powerpoint", "pptx": "fa-file-powerpoint",
        "jpg": "fa-file-image", "jpeg": "fa-file-image", "png": "fa-file-image",
        "gif": "fa-file-image", "bmp": "fa-file-image", "webp": "fa-file-image",
        "svg": "fa-file-image", "ico": "fa-file-image",
        "mp3": "fa-file-audio", "wav": "fa-file-audio", "flac": "fa-file-audio",
        "aac": "fa-file-audio", "ogg": "fa-file-audio",
        "mp4": "fa-file-video", "webm": "fa-file-video", "avi": "fa-file-video",
        "mkv": "fa-file-video", "mov": "fa-file-video",
        "zip": "fa-file-archive", "rar": "fa-file-archive", "7z": "fa-file-archive",
        "tar": "fa-file-archive", "gz": "fa-file-archive",
        "txt": "fa-file-alt", "log": "fa-file-alt",
        "html": "fa-file-code", "htm": "fa-file-code", "css": "fa-file-code",
        "js": "fa-file-code", "ts": "fa-file-code", "json": "fa-file-code",
        "xml": "fa-file-code", "py": "fa-file-code", "java": "fa-file-code",
        "go": "fa-file-code", "c": "fa-file-code", "cpp": "fa-file-code",
        "h": "fa-file-code", "php": "fa-file-code", "rb": "fa-file-code",
        "sql": "fa-file-code", "sh": "fa-file-code", "bat": "fa-file-code",
        "yml": "fa-file-code", "yaml": "fa-file-code", "md": "fa-file-code",
        "vue": "fa-file-code", "jsx": "fa-file-code", "tsx": "fa-file-code",
        "scss": "fa-file-code", "sass": "fa-file-code", "less": "fa-file-code"
    };
    return iconMap[ext] || "fa-file";
}

function getFileIconColor(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    if (["jpg","jpeg","png","gif","bmp","webp","svg","ico","tiff","tif","avif"].includes(ext)) return "#ec4899";
    if (["mp4","webm","avi","mkv","mov"].includes(ext)) return "#8b5cf6";
    if (["mp3","wav","flac","aac","ogg","m4a","wma"].includes(ext)) return "#06b6d4";
    if (["pdf"].includes(ext)) return "#ef4444";
    if (["doc","docx","xls","xlsx","ppt","pptx"].includes(ext)) return "#3b82f6";
    if (["zip","rar","7z","tar","gz"].includes(ext)) return "#f97316";
    if (["html","htm","css","js","ts","json","xml","py","java","go","c","cpp","h","php","rb","sql","sh","bat","yml","yaml","md","vue","jsx","tsx","scss","sass","less"].includes(ext)) return "#22c55e";
    if (["txt","log","cfg","conf","ini","env"].includes(ext)) return "#64748b";
    return "#94a3b8";
}

// ===== 排序 =====
function sortFiles(files) {
    if (!files || files.length === 0) return [];

    // 过滤隐藏文件
    const showHidden = localStorage.getItem('showHidden') === 'true';
    if (!showHidden) {
        files = files.filter(f => !f.name.startsWith('.'));
    }

    const dirs = files.filter(f => f.isDir);
    const regularFiles = files.filter(f => !f.isDir);

    const sortFn = (a, b) => {
        let cmp = 0;
        switch (sortField) {
            case "name": cmp = a.name.localeCompare(b.name, "zh-CN"); break;
            case "size": cmp = a.size - b.size; break;
            case "modified": cmp = new Date(a.modified) - new Date(b.modified); break;
            case "type": cmp = a.name.split('.').pop().localeCompare(b.name.split('.').pop(), "zh-CN"); break;
            default: cmp = a.name.localeCompare(b.name, "zh-CN");
        }
        return sortOrder === "asc" ? cmp : -cmp;
    };

    dirs.sort(sortFn);
    regularFiles.sort(sortFn);
    return [...dirs, ...regularFiles];
}

// ===== 导航 =====
function navigateTo(path) {
    if (path === currentPath) return;
    navHistory = navHistory.slice(0, navIndex + 1);
    navHistory.push(path);
    navIndex = navHistory.length - 1;
    loadFiles(path);
    updateNavButtons();
}

function goBack() {
    if (navIndex > 0) {
        navIndex--;
        loadFiles(navHistory[navIndex]);
        updateNavButtons();
    }
}

function goForward() {
    if (navIndex < navHistory.length - 1) {
        navIndex++;
        loadFiles(navHistory[navIndex]);
        updateNavButtons();
    }
}

function goUp() {
    if (currentPath === "/") return;
    const normalized = currentPath.replace(/\/+$/, "");
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/")) || "/";
    navigateTo(parentPath);
}

function updateNavButtons() {
    const backBtn = document.getElementById("back-btn");
    const forwardBtn = document.getElementById("forward-btn");
    const upBtn = document.getElementById("up-btn");
    if (backBtn) backBtn.disabled = navIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = navIndex >= navHistory.length - 1;
    if (upBtn) upBtn.disabled = currentPath === "/";
}

// ===== API 调用 =====
async function apiCall(url, options = {}) {
    try {
        // 如果有token，添加认证头
        if (authToken) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(API_BASE + url, options);
        const data = await response.json();

        // 如果返回401未授权，清除登录状态（登录请求除外，由handleLogin自行处理）
        if (response.status === 401 && !url.includes('/api/login')) {
            handleLogout();
            return { success: false, message: '登录已过期，请重新登录' };
        }
        if (response.status === 403) {
            return { success: false, message: '权限不足' };
        }
        if (response.status === 429) {
            return { success: false, message: data.message || '操作过于频繁，请稍后再试' };
        }

        return data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

// 带认证头的fetch封装（用于非JSON响应）
function authFetch(url, options = {}) {
    if (authToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(API_BASE + url, options);
}

// 带认证头的XHR封装（用于文件上传）
function authXHR() {
    const xhr = new XMLHttpRequest();
    return xhr;
}

// ===== 文件列表 =====
function loadFiles(path) {
    currentPath = path;
    isSearching = false;
    searchQuery = "";
    apiCall(`/api/list?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (data.success) {
                // 保存当前目录所有文件，用于搜索过滤
                currentAllFiles = data.data.files;
                // 清空搜索框
                document.getElementById("search-input").value = "";
                document.getElementById("search-clear-btn").classList.remove("visible");
                // 渲染文件列表
                renderFiles(sortFiles(currentAllFiles));
                updateBreadcrumb(path);
                updateNavButtons();
            } else {
                showToast(data.message, "error");
            }
        })
        .catch(error => {
            console.error("Error loading files:", error);
            showToast("加载文件列表失败", "error");
        });
}

// ===== 搜索功能 =====
// 执行文件搜索
function searchFiles(query, path = currentPath, recursive = true) {
    if (!query || query.trim() === "") {
        isSearching = false;
        searchQuery = "";
        loadFiles(currentPath);
        return;
    }

    isSearching = true;
    searchQuery = query.trim();

    // 显示加载提示
    const container = document.getElementById("file-container");
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><div class="loading-text">搜索中...</div></div>';

    apiCall(`/api/search?q=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(path)}&recursive=${recursive}`)
        .then(data => {
            if (data.success) {
                currentAllFiles = data.data.files;
                renderFiles(sortFiles(currentAllFiles));

                // 更新状态栏显示搜索结果
                const info = document.getElementById("file-count-info");
                if (info) {
                    info.textContent = `找到 ${data.data.count} 个匹配项`;
                }

                // 显示搜索提示
                showToast(`找到 ${data.data.count} 个匹配项`, "success");
            } else {
                showToast(data.message, "error");
                loadFiles(currentPath);
            }
        })
        .catch(error => {
            console.error("Error searching files:", error);
            showToast("搜索失败", "error");
            loadFiles(currentPath);
        });
}

// 清除搜索
function clearSearch() {
    document.getElementById("search-input").value = "";
    document.getElementById("search-clear-btn").classList.remove("visible");
    isSearching = false;
    searchQuery = "";
    loadFiles(currentPath);
}

function renderFiles(files) {
    const container = document.getElementById("file-container");
    container.innerHTML = "";

    // 保存当前目录的图片文件列表
    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif", "avif"];
    currentImageList = files.filter(f => !f.isDir && imageExts.includes(f.name.split(".").pop().toLowerCase()));

    const isListView = container.classList.contains("list-view");

    // 列表头
    if (isListView) {
        const header = document.createElement("div");
        header.className = "list-header";
        header.innerHTML =
            '<div class="list-header-icon"></div>' +
            '<div class="list-header-name">名称</div>' +
            '<div class="list-header-size">大小</div>' +
            '<div class="list-header-time">修改时间</div>';
        container.appendChild(header);
    }

    files.forEach((file, index) => {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        fileItem.dataset.path = file.path;
        fileItem.dataset.name = file.name;
        fileItem.dataset.isDir = file.isDir;
        fileItem.style.animationDelay = Math.min(index * 0.03, 0.3) + "s";

        const icon = file.isDir ? "fa-folder" : getFileIcon(file.name);
        const iconColor = file.isDir ? "#f59e0b" : getFileIconColor(file.name);

        if (isListView) {
            fileItem.innerHTML =
                '<i class="fas ' + icon + ' file-icon" style="color:' + iconColor + '"></i>' +
                '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
                (file.isDir ? '<div class="file-meta"></div>' : '<div class="file-meta">' + formatFileSize(file.size) + '</div>') +
                (file.isDir ? '<div class="file-time"></div>' : '<div class="file-time">' + formatDate(file.modified) + '</div>');
        } else {
            fileItem.innerHTML =
                '<i class="fas ' + icon + ' file-icon" style="color:' + iconColor + '"></i>' +
                '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
                (file.isDir ? '' : '<div class="file-meta">' + formatFileSize(file.size) + '</div>');
        }

        fileItem.addEventListener("click", function(e) {
            e.stopPropagation();
            selectFile(this, e.ctrlKey || e.metaKey, e.shiftKey, index);
        });

        fileItem.addEventListener("dblclick", function(e) {
            e.stopPropagation();
            clearSelection();

            if (file.isDir) {
                navigateTo(file.path);
            } else {
                openFile(file.path, file.name);
            }
        });

        fileItem.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            // 如果文件未被选中，则选中它；如果已选中，保持选中状态
            if (!this.classList.contains("selected")) {
                selectFile(this, false, false, index);
            }
            showContextMenu(e.clientX, e.clientY, file);
        });

        container.appendChild(fileItem);
    });

    if (files.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-state-icon"><i class="fas fa-folder-open"></i></div>' +
                '<div class="empty-state-text">此文件夹为空</div>' +
            '</div>';
    }

    const dirCount = files.filter(f => f.isDir).length;
    const fileCount = files.filter(f => !f.isDir).length;
    updateStatusBar(fileCount, dirCount);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function selectFile(fileItem, ctrlKey, shiftKey, index) {
    const isAlreadySelected = fileItem.classList.contains("selected");

    // Shift 范围选
    if (shiftKey && lastSelectedIndex >= 0) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        // 如果没有 Ctrl，先清除其他选中
        if (!ctrlKey) {
            document.querySelectorAll(".file-item.selected").forEach(item => item.classList.remove("selected"));
            selectedFiles = [];
        }
        const container = document.getElementById("file-container");
        const items = container.querySelectorAll(".file-item");
        for (let i = start; i <= end; i++) {
            const item = items[i];
            if (item && !item.classList.contains("selected")) {
                item.classList.add("selected");
                selectedFiles.push({
                    path: item.dataset.path,
                    name: item.dataset.name,
                    isDir: item.dataset.isDir === "true"
                });
            }
        }
        updateSelectionInfo();
        return;
    }

    // Ctrl 多选
    if (ctrlKey) {
        if (isAlreadySelected) {
            fileItem.classList.remove("selected");
            selectedFiles = selectedFiles.filter(f => f.path !== fileItem.dataset.path);
        } else {
            fileItem.classList.add("selected");
            selectedFiles.push({
                path: fileItem.dataset.path,
                name: fileItem.dataset.name,
                isDir: fileItem.dataset.isDir === "true"
            });
        }
        lastSelectedIndex = index;
        updateSelectionInfo();
        return;
    }

    // 普通单击：如果已选中则取消，否则仅选中当前
    if (isAlreadySelected) {
        fileItem.classList.remove("selected");
        selectedFiles = selectedFiles.filter(f => f.path !== fileItem.dataset.path);
        updateSelectionInfo();
        return;
    }

    document.querySelectorAll(".file-item.selected").forEach(item => item.classList.remove("selected"));
    fileItem.classList.add("selected");
    selectedFiles = [{
        path: fileItem.dataset.path,
        name: fileItem.dataset.name,
        isDir: fileItem.dataset.isDir === "true"
    }];
    lastSelectedIndex = index;
    updateSelectionInfo();
}

// 更新选中状态信息
function updateSelectionInfo() {
    const info = document.getElementById("selected-file-info");
    const downloadBtn = document.getElementById("download-btn");
    // 隐藏二维码弹出框
    var qrPopup = document.getElementById('qr-popup');
    if (qrPopup) qrPopup.classList.remove('show');
    if (!info) return;
    if (selectedFiles.length === 0) {
        info.textContent = "";
        selectedFile = null;
        if (downloadBtn) {
            downloadBtn.disabled = true;
        }
    } else if (selectedFiles.length === 1) {
        info.textContent = selectedFiles[0].name;
        selectedFile = selectedFiles[0];
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
    } else {
        info.textContent = selectedFiles.length + " 个项目已选中";
        selectedFile = selectedFiles[0]; // 右键菜单使用第一个
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
    }
}

// 清除所有选中
function clearSelection() {
    document.querySelectorAll(".file-item.selected").forEach(item => item.classList.remove("selected"));
    selectedFiles = [];
    selectedFile = null;
    lastSelectedIndex = -1;
    const info = document.getElementById("selected-file-info");
    if (info) info.textContent = "";
}

// ===== 拖选功能 =====
function setupDragSelection() {
    const contentArea = document.getElementById("content-area");
    const fileContainer = document.getElementById("file-container");
    
    // 创建拖选框元素
    dragSelectionBox = document.createElement("div");
    dragSelectionBox.className = "drag-selection-box";
    dragSelectionBox.style.display = "none";
    contentArea.appendChild(dragSelectionBox);
    
    let startX, startY;
    let hasMoved = false; // 标记鼠标是否移动过
    
    // 鼠标按下开始拖选
    contentArea.addEventListener("mousedown", function(e) {
        // 如果点击的是文件项或工具栏，不进行拖选
        if (e.target.closest(".file-item") || e.target.closest(".toolbar")) {
            return;
        }
        
        // 只在左键按下时开始拖选
        if (e.button !== 0) return;
        
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        
        // 清除之前的选中状态
        clearSelection();
        
        // 显示并初始化拖选框
        dragSelectionBox.style.display = "block";
        dragSelectionBox.style.left = startX + "px";
        dragSelectionBox.style.top = startY + "px";
        dragSelectionBox.style.width = "0px";
        dragSelectionBox.style.height = "0px";
        
        e.preventDefault();
    });
    
    // 鼠标移动更新拖选框
    document.addEventListener("mousemove", function(e) {
        if (!isDragging) return;
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        // 检查鼠标是否移动过（避免微小抖动触发拖选）
        if (!hasMoved && Math.abs(currentX - startX) < 3 && Math.abs(currentY - startY) < 3) {
            return;
        }
        hasMoved = true;
        
        // 计算拖选框的位置和大小
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        dragSelectionBox.style.left = left + "px";
        dragSelectionBox.style.top = top + "px";
        dragSelectionBox.style.width = width + "px";
        dragSelectionBox.style.height = height + "px";
        
        // 检查哪些文件项在拖选框内
        selectItemsInBox(left, top, width, height);
    });
    
    // 鼠标松开结束拖选
    document.addEventListener("mouseup", function(e) {
        if (!isDragging) return;
        
        // 如果鼠标没有移动过，说明是点击而不是拖选
        if (!hasMoved) {
            clearSelection();
        }
        
        dragSelectionBox.style.display = "none";
        dragSelectionBox.style.width = "0px";
        dragSelectionBox.style.height = "0px";
        
        // 延迟重置 isDragging 状态，避免 click 事件触发时取消选择
        setTimeout(() => {
            isDragging = false;
        }, 50);
    });
}

// 选择拖选框内的文件项
function selectItemsInBox(left, top, width, height) {
    const fileItems = document.querySelectorAll(".file-item");
    const boxRect = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
    };
    
    // 清除之前的选中状态
    selectedFiles = [];
    
    fileItems.forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();
        
        // 检查文件项是否与拖选框相交
        const isIntersecting = !(
            itemRect.right < boxRect.left ||
            itemRect.left > boxRect.right ||
            itemRect.bottom < boxRect.top ||
            itemRect.top > boxRect.bottom
        );
        
        if (isIntersecting) {
            item.classList.add("selected");
            selectedFiles.push({
                path: item.dataset.path,
                name: item.dataset.name,
                isDir: item.dataset.isDir === "true"
            });
            if (selectedFiles.length === 1) {
                lastSelectedIndex = index;
            }
        } else {
            item.classList.remove("selected");
        }
    });
    
    updateSelectionInfo();
}

function updateStatusBar(fileCount, dirCount) {
    const info = document.getElementById("file-count-info");
    if (!info) return;
    const parts = [];
    if (dirCount > 0) parts.push(dirCount + " 个文件夹");
    if (fileCount > 0) parts.push(fileCount + " 个文件");
    info.textContent = parts.length > 0 ? parts.join("，") : "空文件夹";
}

// ===== 面包屑导航 =====
function updateBreadcrumb(path) {
    const container = document.getElementById("breadcrumb-container");
    container.innerHTML = "";

    const rootItem = document.createElement("div");
    rootItem.className = "breadcrumb-item";
    rootItem.innerHTML = '<i class="fas fa-home breadcrumb-icon"></i>';
    rootItem.addEventListener("click", function() { navigateTo("/"); });
    container.appendChild(rootItem);

    if (path === "/") return;

    const parts = path.split("/").filter(p => p !== "");
    let currentBreadcrumbPath = "";

    parts.forEach((part, index) => {
        currentBreadcrumbPath += "/" + part;

        const sep = document.createElement("span");
        sep.className = "breadcrumb-separator";
        sep.innerHTML = '<i class="fas fa-chevron-right"></i>';
        container.appendChild(sep);

        const item = document.createElement("div");
        item.className = "breadcrumb-item";
        if (index === parts.length - 1) item.classList.add("current");
        item.textContent = part;

        if (index < parts.length - 1) {
            const clickPath = currentBreadcrumbPath;
            item.addEventListener("click", function() { navigateTo(clickPath); });
        }

        container.appendChild(item);
    });
}

// ===== 目录树 =====
function loadTree() {
    apiCall('/api/list?path=/')
        .then(data => {
            if (data.success) {
                renderTree(data.data.files, document.getElementById("tree-container"));
            }
        })
        .catch(() => {});
}

function renderTree(files, container) {
    container.innerHTML = "";
    const dirs = files.filter(f => f.isDir);
    dirs.forEach(dir => {
        container.appendChild(createTreeItem(dir.path, dir.name));
    });
}

function createTreeItem(path, name) {
    const node = document.createElement("div");
    node.className = "tree-node";

    const item = document.createElement("div");
    item.className = "tree-item";
    item.dataset.path = path;
    item.innerHTML =
        '<i class="fas fa-chevron-right tree-toggle"></i>' +
        '<i class="fas fa-folder tree-icon"></i>' +
        '<span class="tree-label">' + escapeHtml(name) + '</span>';

    const children = document.createElement("div");
    children.className = "tree-children collapsed";
    children.style.maxHeight = "0px";

    const toggleIcon = item.querySelector(".tree-toggle");

    item.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleTreeChildren(children, toggleIcon);
        if (children.innerHTML === "") {
            loadTreeChildren(path, children);
        }
        navigateTo(path);
        document.querySelectorAll(".tree-item.active").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
    });

    node.appendChild(item);
    node.appendChild(children);
    return node;
}

function loadTreeChildren(path, container) {
    apiCall(`/api/list?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (data.success) {
                renderTree(data.data.files, container);
            }
        })
        .catch(() => {});
}

function setupRootTreeToggle() {
    const rootItem = document.querySelector(".tree-root");
    if (rootItem) {
        const toggleIcon = rootItem.querySelector(".tree-toggle");
        const treeContainer = document.getElementById("tree-container");

        rootItem.addEventListener("click", function(e) {
            e.stopPropagation();
            if (treeContainer) {
                toggleTreeChildren(treeContainer, toggleIcon);
            }
            navigateTo("/");
        });
    }
}

function toggleTreeChildren(childContainer, toggleIcon) {
    const isCollapsed = childContainer.classList.contains("collapsed");
    if (isCollapsed) {
        childContainer.classList.remove("collapsed");
        childContainer.style.maxHeight = childContainer.scrollHeight + "px";
        toggleIcon.className = "fas fa-chevron-down tree-toggle";
        setTimeout(() => {
            if (!childContainer.classList.contains("collapsed")) {
                childContainer.style.maxHeight = "none";
            }
        }, 300);
    } else {
        childContainer.style.maxHeight = childContainer.scrollHeight + "px";
        childContainer.offsetHeight; // force reflow
        childContainer.classList.add("collapsed");
        childContainer.style.maxHeight = "0px";
        toggleIcon.className = "fas fa-chevron-right tree-toggle";
    }
}

// ===== 存储空间 =====
function calculateStorage() {
    // 未登录时不调用存储空间API
    if (!authToken || !currentUser) {
        const storageText = document.getElementById("storage-text");
        if (storageText) {
            storageText.textContent = "未登录";
        }
        return;
    }

    apiCall('/api/storage')
        .then(data => {
            if (!data.success) return;
            const usedSize = data.data.usedSize;
            const maxSize = data.data.maxSize;
            const usedBar = document.getElementById("storage-used");
            const storageText = document.getElementById("storage-text");
            if (usedBar && maxSize > 0) {
                const percent = usedSize / maxSize * 100;
                usedBar.style.width = Math.min(percent, 100) + "%";
                usedBar.classList.toggle("warning", percent > 80);
            }
            if (storageText) {
                storageText.textContent = formatFileSize(usedSize) + " / " + formatFileSize(maxSize);
            }
        })
        .catch(() => {});
}

// 检查文件大小是否超过最大容量
function checkStorageSpace(files) {
    return apiCall('/api/storage')
        .then(data => {
            if (!data.success) return false;
            const usedSize = data.data.usedSize;
            const maxSize = data.data.maxSize;
            
            // 计算文件总大小
            let totalSize = 0;
            for (const file of files) {
                totalSize += file.size;
            }
            
            // 检查是否超过最大容量
            if (usedSize + totalSize > maxSize) {
                const remainingSpace = maxSize - usedSize;
                showToast(`存储空间不足！剩余空间: ${formatFileSize(remainingSpace)}，需要空间: ${formatFileSize(totalSize)}`, 'error');
                return false;
            }
            return true;
        })
        .catch(() => {
            showToast('无法获取存储空间信息', 'error');
            return false;
        });
}

// ===== 上传文件 =====
function uploadFiles() {
    // 权限验证：只有登录用户可以上传文件
    if (!currentUser) {
        showToast('请先登录后再上传文件', 'error');
        return;
    }

    const fileInput = document.getElementById("file-input");
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast("请选择要上传的文件", "error");
        return;
    }

    // 检查存储空间
    const files = Array.from(fileInput.files);
    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }

        // 分批上传，每批最多100个文件
        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;
        // 生成唯一会话ID，确保不同上传操作不会互相干扰
        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {
                // 所有批次上传完成
                progressDiv.style.display = "none";
                progressBar.style.width = "0%";
                progressBar.classList.remove("progress-bar-animated");
                progressText.textContent = "0%";
                
                loadFiles(currentPath);
                loadTree();
                calculateStorage();
                
                if (failedCount > 0) {
                    showToast(`上传完成：成功 ${uploadedCount} 个，失败 ${failedCount} 个`, "warning");
                } else {
                    showToast("文件上传成功", "success");
                }
                closeModal("upload-modal");
                return;
            }

            const start = currentBatch * batchSize;
            const end = Math.min(start + batchSize, files.length);
            const batchFiles = files.slice(start, end);

            const formData = new FormData();
            for (let i = 0; i < batchFiles.length; i++) {
                formData.append("files", batchFiles[i]);
            }
            formData.append("path", currentPath);
            formData.append("conflict", localStorage.getItem('uploadConflict') || 'rename');
            formData.append("uploadSessionId", uploadSessionId);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", API_BASE + "/api/upload");

            // 添加认证头
            if (authToken) {
                xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
            }

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const batchPercent = Math.round(e.loaded / e.total * 100);
                    const totalPercent = Math.round(((currentBatch * batchSize) + (batchPercent / 100 * batchFiles.length)) / files.length * 100);
                    progressBar.style.width = totalPercent + "%";
                    progressText.textContent = `正在上传第 ${currentBatch + 1}/${totalBatches} 批 (${totalPercent}%)`;
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        uploadedCount += data.uploadedCount || batchFiles.length;
                        if (data.failedCount) {
                            failedCount += data.failedCount;
                        }
                    } else {
                        failedCount += batchFiles.length;
                        showToast(data.message || "上传失败", "error");
                    }
                } else if (xhr.status === 401) {
                    handleLogout();
                    return;
                } else {
                    failedCount += batchFiles.length;
                    showToast("上传失败", "error");
                }

                currentBatch++;
                // 继续上传下一批
                setTimeout(uploadBatch, 100); // 添加小延迟，避免服务器压力过大
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");
                // 继续上传下一批
                currentBatch++;
                setTimeout(uploadBatch, 1000); // 失败后等待1秒再重试
            };

            xhr.send(formData);
        }

        // 开始上传第一批
        uploadBatch();
    });
}

// ===== 上传文件夹 =====
function uploadFolder() {
    // 权限验证：只有登录用户可以上传文件夹
    if (!currentUser) {
        showToast('请先登录后再上传文件夹', 'error');
        return;
    }

    const folderInput = document.getElementById("folder-input");
    if (!folderInput.files || folderInput.files.length === 0) {
        showToast("请选择要上传的文件夹", "error");
        return;
    }

    // 检查存储空间
    const files = Array.from(folderInput.files);
    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }

        // 分批上传，每批最多100个文件
        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;
        // 生成唯一会话ID，确保不同上传操作不会互相干扰
        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("folder-upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {
                // 所有批次上传完成
                progressDiv.style.display = "none";
                progressBar.style.width = "0%";
                progressBar.classList.remove("progress-bar-animated");
                progressText.textContent = "0%";
                
                loadFiles(currentPath);
                loadTree();
                calculateStorage();
                
                if (failedCount > 0) {
                    showToast(`上传完成：成功 ${uploadedCount} 个，失败 ${failedCount} 个`, "warning");
                } else {
                    showToast("文件夹上传成功", "success");
                }
                closeModal("upload-folder-modal");
                return;
            }

            const start = currentBatch * batchSize;
            const end = Math.min(start + batchSize, files.length);
            const batchFiles = files.slice(start, end);

            const formData = new FormData();
            const pathMap = {};
            for (let i = 0; i < batchFiles.length; i++) {
                const file = batchFiles[i];
                const relativePath = file.webkitRelativePath || file.name;
                const indexedName = String(start + i);
                formData.append("files", file, indexedName);
                pathMap[indexedName] = relativePath;
            }
            formData.append("path", currentPath);
            formData.append("pathMap", JSON.stringify(pathMap));
            formData.append("conflict", localStorage.getItem('uploadConflict') || 'rename');
            formData.append("uploadSessionId", uploadSessionId);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", API_BASE + "/api/upload");

            // 添加认证头
            if (authToken) {
                xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
            }

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const batchPercent = Math.round(e.loaded / e.total * 100);
                    const totalPercent = Math.round(((currentBatch * batchSize) + (batchPercent / 100 * batchFiles.length)) / files.length * 100);
                    progressBar.style.width = totalPercent + "%";
                    progressText.textContent = `正在上传第 ${currentBatch + 1}/${totalBatches} 批 (${totalPercent}%)`;
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        uploadedCount += data.uploadedCount || batchFiles.length;
                        if (data.failedCount) {
                            failedCount += data.failedCount;
                        }
                    } else {
                        failedCount += batchFiles.length;
                        showToast(data.message || "上传失败", "error");
                    }
                } else if (xhr.status === 401) {
                    handleLogout();
                    return;
                } else {
                    failedCount += batchFiles.length;
                    showToast("上传失败", "error");
                }

                currentBatch++;
                // 继续上传下一批
                setTimeout(uploadBatch, 100); // 添加小延迟，避免服务器压力过大
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");
                // 继续上传下一批
                currentBatch++;
                setTimeout(uploadBatch, 1000); // 失败后等待1秒再重试
            };

            xhr.send(formData);
        }

        // 开始上传第一批
        uploadBatch();
    });
}

// ===== 拖拽上传区域 =====
function setupDropzone(dropzoneId, inputId) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(inputId);

    fileInput.addEventListener("click", function(e) {
        e.stopPropagation();
    });

    dropzone.addEventListener("click", function(e) {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    dropzone.addEventListener("dragover", function(e) {
        e.preventDefault();
        this.classList.add("drag-over");
    });

    dropzone.addEventListener("dragleave", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
    });

    dropzone.addEventListener("drop", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");

        // 使用 webkitGetAsEntry 支持拖拽文件夹时保持目录结构
        const items = e.dataTransfer.items;
        if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            const entries = [];
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) entries.push(entry);
            }
            // 检查是否包含目录
            const hasDir = entries.some(entry => entry.isDirectory);
            if (hasDir) {
                traverseEntries(entries, "").then(files => {
                    if (files.length === 0) {
                        showToast("未找到可上传的文件", "error");
                        return;
                    }
                    uploadDroppedFiles(files, currentPath);
                });
                return;
            }
        }

        // 普通文件拖拽，走原有逻辑
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
    });
}

// 递归遍历文件系统条目，收集所有文件及其相对路径
async function traverseEntries(entries, basePath) {
    const files = [];
    for (const entry of entries) {
        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));
            // 创建带相对路径的文件对象
            const relativePath = basePath ? basePath + "/" + file.name : file.name;
            Object.defineProperty(file, "relativePath", { value: relativePath, writable: false });
            files.push(file);
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const subEntries = await new Promise(resolve => {
                const results = [];
                function readBatch() {
                    dirReader.readEntries(batch => {
                        if (batch.length === 0) {
                            resolve(results);
                            return;
                        }
                        results.push(...batch);
                        readBatch();
                    });
                }
                readBatch();
            });
            const dirPath = basePath ? basePath + "/" + entry.name : entry.name;
            const subFiles = await traverseEntries(subEntries, dirPath);
            files.push(...subFiles);
        }
    }
    return files;
}

// 上传拖拽的文件（支持保持文件夹结构）
function uploadDroppedFiles(files, targetPath) {
    // 权限验证：只有登录用户可以上传文件
    if (!currentUser) {
        showToast('请先登录后再上传文件', 'error');
        return;
    }

    // 检查存储空间
    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }

        // 分批上传，每批最多100个文件
        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;
        // 生成唯一会话ID，确保不同上传操作不会互相干扰
        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {
                // 所有批次上传完成
                progressDiv.style.display = "none";
                progressBar.style.width = "0%";
                progressBar.classList.remove("progress-bar-animated");
                progressText.textContent = "0%";
                
                loadFiles(currentPath);
                loadTree();
                calculateStorage();
                
                if (failedCount > 0) {
                    showToast(`上传完成：成功 ${uploadedCount} 个，失败 ${failedCount} 个`, "warning");
                } else {
                    showToast("上传成功", "success");
                }
                closeModal("upload-modal");
                return;
            }

            const start = currentBatch * batchSize;
            const end = Math.min(start + batchSize, files.length);
            const batchFiles = files.slice(start, end);

            const formData = new FormData();
            const pathMap = {};
            for (let i = 0; i < batchFiles.length; i++) {
                const file = batchFiles[i];
                const relativePath = file.relativePath || file.webkitRelativePath || file.name;
                const indexedName = String(start + i);
                formData.append("files", file, indexedName);
                pathMap[indexedName] = relativePath;
            }
            formData.append("path", targetPath);
            formData.append("pathMap", JSON.stringify(pathMap));
            formData.append("uploadSessionId", uploadSessionId);
            formData.append("conflict", localStorage.getItem('uploadConflict') || 'rename');

            const xhr = new XMLHttpRequest();
            xhr.open("POST", API_BASE + "/api/upload");

            // 添加认证头
            if (authToken) {
                xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
            }

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const batchPercent = Math.round(e.loaded / e.total * 100);
                    const totalPercent = Math.round(((currentBatch * batchSize) + (batchPercent / 100 * batchFiles.length)) / files.length * 100);
                    progressBar.style.width = totalPercent + "%";
                    progressText.textContent = `正在上传第 ${currentBatch + 1}/${totalBatches} 批 (${totalPercent}%)`;
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        uploadedCount += data.uploadedCount || batchFiles.length;
                        if (data.failedCount) {
                            failedCount += data.failedCount;
                        }
                    } else {
                        failedCount += batchFiles.length;
                        showToast(data.message || "上传失败", "error");
                    }
                } else if (xhr.status === 401) {
                    handleLogout();
                    return;
                } else {
                    failedCount += batchFiles.length;
                    showToast("上传失败", "error");
                }

                currentBatch++;
                // 继续上传下一批
                setTimeout(uploadBatch, 100); // 添加小延迟，避免服务器压力过大
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");
                // 继续上传下一批
                currentBatch++;
                setTimeout(uploadBatch, 1000); // 失败后等待1秒再重试
            };

            xhr.send(formData);
        }

        // 开始上传第一批
        uploadBatch();
    });
}

function displayUploadFileList(files) {
    const placeholder = document.getElementById("upload-dropzone-placeholder");
    const fileList = document.getElementById("upload-file-list");
    const fileItems = document.getElementById("upload-file-items");
    const fileCount = document.getElementById("upload-file-count");

    if (files.length === 0) {
        placeholder.style.display = "";
        fileList.style.display = "none";
        document.getElementById("upload-dropzone").classList.remove("has-files");
        return;
    }

    placeholder.style.display = "none";
    fileList.style.display = "";
    document.getElementById("upload-dropzone").classList.add("has-files");
    fileCount.textContent = files.length + " 个文件";

    fileItems.innerHTML = "";
    for (let i = 0; i < Math.min(files.length, 10); i++) {
        const item = document.createElement("div");
        item.className = "dropzone-file-item";
        const icon = getFileIcon(files[i].name);
        item.innerHTML = '<i class="fas ' + icon + ' dropzone-file-icon"></i>' +
            '<span class="dropzone-file-item-name">' + escapeHtml(files[i].name) + '</span>' +
            '<span class="dropzone-file-item-size">' + formatFileSize(files[i].size) + '</span>';
        fileItems.appendChild(item);
    }
    if (files.length > 10) {
        const more = document.createElement("div");
        more.className = "dropzone-file-more";
        more.textContent = "...还有 " + (files.length - 10) + " 个文件";
        fileItems.appendChild(more);
    }
}

function displayFolderFileList(files) {
    const placeholder = document.getElementById("folder-dropzone-placeholder");
    const fileList = document.getElementById("folder-file-list");
    const fileItems = document.getElementById("folder-file-items");
    const fileCount = document.getElementById("folder-file-count");

    if (files.length === 0) {
        placeholder.style.display = "";
        fileList.style.display = "none";
        document.getElementById("folder-dropzone").classList.remove("has-files");
        return;
    }

    placeholder.style.display = "none";
    fileList.style.display = "";
    document.getElementById("folder-dropzone").classList.add("has-files");
    fileCount.textContent = files.length + " 个文件";

    fileItems.innerHTML = "";
    for (let i = 0; i < Math.min(files.length, 10); i++) {
        const item = document.createElement("div");
        item.className = "dropzone-file-item";
        const icon = getFileIcon(files[i].name);
        const displayName = files[i].webkitRelativePath || files[i].name;
        item.innerHTML = '<i class="fas ' + icon + ' dropzone-file-icon"></i>' +
            '<span class="dropzone-file-item-name">' + escapeHtml(displayName) + '</span>' +
            '<span class="dropzone-file-item-size">' + formatFileSize(files[i].size) + '</span>';
        fileItems.appendChild(item);
    }
    if (files.length > 10) {
        const more = document.createElement("div");
        more.className = "dropzone-file-more";
        more.textContent = "...还有 " + (files.length - 10) + " 个文件";
        fileItems.appendChild(more);
    }
}

// ===== 文件操作 =====
function downloadFile(path) {
    // 使用authFetch下载文件，支持认证头
    authFetch(`/api/download?path=${encodeURIComponent(path)}`)
        .then(response => {
            if (!response.ok) throw new Error('下载失败');
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // 从路径中提取文件名
            const fileName = path.split('/').pop();
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('Download error:', error);
            showToast('下载失败', 'error');
        });
}

function downloadSelectedFiles() {
    if (selectedFiles.length === 0) {
        showToast("请先选择要下载的文件", "error");
        return;
    }

    // 单个普通文件直接下载
    if (selectedFiles.length === 1 && !selectedFiles[0].isDir) {
        showToast("正在准备下载...", "info");
        downloadFile(selectedFiles[0].path);
        return;
    }

    // 目录或批量下载：使用batch-download API打包为zip
    showToast("正在打包文件，请稍候...", "info");
    
    // 提前保存文件信息，防止异步操作中被修改
    const filesToDownload = [...selectedFiles];
    const paths = filesToDownload.map(f => f.path);
    
    const downloadBtn = document.getElementById("download-btn");
    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>准备中...</span>';

    authFetch('/api/batch-download', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: paths })
    })
    .then(response => {
        if (!response.ok) throw new Error("下载失败");
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // 单个目录用目录名，多个用"第一个文件+..等.zip"
        const zipName = filesToDownload.length === 1 ? filesToDownload[0].name + ".zip" : filesToDownload[0].name + "..等.zip";
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast("下载已开始", "success");
    })
    .catch(error => {
        console.error("Download error:", error);
        showToast("下载失败", "error");
    })
    .finally(() => {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalHTML;
    });
}

function deleteFile(path) {
    // 权限验证
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以删除文件', 'error');
        return;
    }

    if (!confirm("确定要删除此文件吗？此操作不可撤销。")) return;

    apiCall('/api/delete', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            loadTree();
            calculateStorage();
            showToast("删除成功", "success");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error deleting file:", error);
        showToast("删除失败", "error");
    });
}

// 批量删除文件
function batchDeleteFiles(paths) {
    // 权限验证
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以删除文件', 'error');
        return;
    }

    if (paths.length === 0) return;
    if (!confirm(`确定要删除选中的 ${paths.length} 个项目吗？此操作不可撤销。`)) return;

    apiCall('/api/delete', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: paths })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            loadTree();
            calculateStorage();
            const result = data.data;
            if (result.failedCount > 0) {
                showToast(`已删除 ${result.deletedCount}/${result.totalCount} 个项目，${result.failedCount} 个失败`, "warning");
            } else {
                showToast(`已删除 ${result.deletedCount} 个项目`, "success");
            }
            clearSelection();
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error batch deleting:", error);
        showToast("批量删除失败", "error");
    });
}

function renameFile() {
    // 权限验证：只有管理员可以重命名
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以重命名文件', 'error');
        return;
    }

    if (!selectedFile) return;

    const newName = document.getElementById("rename-input").value.trim();
    if (!newName) {
        showToast("请输入新名称", "error");
        return;
    }

    apiCall('/api/rename', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: selectedFile.path, newName: newName })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            loadTree();
            showToast("重命名成功", "success");
            closeModal("rename-modal");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error renaming file:", error);
        showToast("重命名失败", "error");
    });
}

function openRenameModal() {
    // 权限验证：只有管理员可以重命名
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以重命名文件', 'error');
        return;
    }

    if (!selectedFile) return;
    document.getElementById("rename-input").value = selectedFile.name;
    openModal("rename-modal");
    setTimeout(() => {
        const input = document.getElementById("rename-input");
        input.focus();
        const dotIndex = selectedFile.name.lastIndexOf(".");
        if (dotIndex > 0 && !selectedFile.isDir) {
            input.setSelectionRange(0, dotIndex);
        } else {
            input.select();
        }
    }, 100);
}

function createFolder() {
    // 权限验证：只有管理员可以创建文件夹
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以创建文件夹', 'error');
        return;
    }

    const name = document.getElementById("folder-name-input").value.trim();
    if (!name) {
        showToast("请输入文件夹名称", "error");
        return;
    }

    apiCall('/api/create-folder', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, folderName: name })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            loadTree();
            showToast("文件夹创建成功", "success");
            closeModal("folder-modal");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error creating folder:", error);
        showToast("创建文件夹失败", "error");
    });
}

function createFile() {
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以创建文件', 'error');
        return;
    }
    const name = document.getElementById("create-file-name-input").value.trim();
    if (!name) {
        showToast("请输入文件名称", "error");
        return;
    }
    apiCall('/api/create-file', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, fileName: name })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            showToast("文件创建成功", "success");
            closeModal("create-file-modal");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error creating file:", error);
        showToast("创建文件失败", "error");
    });
}


// ===== 新建文件 =====
function createFile() {
    // 权限验证：只有管理员可以创建文件
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以创建文件', 'error');
        return;
    }

    const name = document.getElementById("create-file-name-input").value.trim();
    if (!name) {
        showToast("请输入文件名称", "error");
        return;
    }

    apiCall('/api/create-file', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, fileName: name })
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            showToast("文件创建成功", "success");
            closeModal("create-file-modal");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error creating file:", error);
        showToast("创建文件失败", "error");
    });
}

// ===== 移动/复制 =====
function openMoveCopyModal() {
    // 权限验证：只有管理员可以移动/复制文件
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以移动或复制文件', 'error');
        return;
    }

    if (selectedFiles.length === 0) return;

    const title = document.getElementById("move-copy-title");
    const isMulti = selectedFiles.length > 1;
    if (isMulti) {
        title.textContent = clipboard.action === "move" ? `批量移动 (${selectedFiles.length} 个项目)` : `批量复制 (${selectedFiles.length} 个项目)`;
    } else {
        title.textContent = clipboard.action === "move" ? "移动文件" : "复制文件";
    }

    loadDestinationTree();
    openModal("move-copy-modal");
}

// 目标目录树当前路径
let destCurrentPath = "/";
let destExpandedPaths = new Set();

function loadDestinationTree() {
    destCurrentPath = "/";
    destExpandedPaths.clear();
    loadDestinationPath(destCurrentPath);
}

function loadDestinationPath(path) {
    destCurrentPath = path;
    apiCall(`/api/list?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (data.success) {
                renderDestinationTree(data.data.files);
            }
        })
        .catch(() => {});
}

function renderDestinationTree(files) {
    const container = document.getElementById("destination-tree");
    container.innerHTML = "";
    
    const dirs = files.filter(f => f.isDir);

        // 添加根目录选项
    const rootItem = document.createElement("div");
    rootItem.className = "dest-tree-item";
    rootItem.dataset.path = "/";
    rootItem.innerHTML =
        '<i class="fas fa-home dest-tree-icon"></i>' +
        '<span>根目录</span>';
    
    rootItem.addEventListener("click", function() {
        document.querySelectorAll(".dest-tree-item.selected").forEach(i => i.classList.remove("selected"));
        rootItem.classList.add("selected");
    });
    
    container.appendChild(rootItem);
    
    if (dirs.length === 0) {
        container.innerHTML = '<div class="dest-empty">此目录为空</div>';
        return;
    }
    
    dirs.forEach(dir => {
        const item = document.createElement("div");
        item.className = "dest-tree-item";
        item.dataset.path = dir.path;
        
        const isExpanded = destExpandedPaths.has(dir.path);
        item.innerHTML =
            '<i class="fas fa-chevron-right dest-tree-toggle' + (isExpanded ? " expanded" : "") + '"></i>' +
            '<i class="fas fa-folder dest-tree-icon"></i>' +
            '<span>' + escapeHtml(dir.name) + '</span>';
        
        // 点击展开/折叠
        const toggleIcon = item.querySelector(".dest-tree-toggle");
        toggleIcon.addEventListener("click", function(e) {
            e.stopPropagation();
            toggleDestFolder(dir.path, item);
        });
        
        // 点击展开/折叠并选择目录
        item.addEventListener("click", function() {
            document.querySelectorAll(".dest-tree-item.selected").forEach(i => i.classList.remove("selected"));
            item.classList.add("selected");
            toggleDestFolder(dir.path, item);
        });
        
        // 单击展开/折叠（与toggle图标效果一致）
        // 已在click事件中处理
        
        container.appendChild(item);
        
        // 如果已展开，加载子目录
        if (isExpanded) {
            const childrenContainer = document.createElement("div");
            childrenContainer.className = "dest-tree-children";
            childrenContainer.style.paddingLeft = "20px";
            container.appendChild(childrenContainer);
            
            apiCall(`/api/list?path=${encodeURIComponent(dir.path)}`)
                .then(data => {
                    if (data.success) {
                        renderDestinationTreeChildren(data.data.files, childrenContainer, dir.path);
                    }
                })
                .catch(() => {});
        }
    });
}

function renderDestinationTreeChildren(files, container, parentPath) {
    const dirs = files.filter(f => f.isDir);
    
    dirs.forEach(dir => {
        const item = document.createElement("div");
        item.className = "dest-tree-item";
        item.dataset.path = dir.path;
        
        const isExpanded = destExpandedPaths.has(dir.path);
        item.innerHTML =
            '<i class="fas fa-chevron-right dest-tree-toggle' + (isExpanded ? " expanded" : "") + '"></i>' +
            '<i class="fas fa-folder dest-tree-icon"></i>' +
            '<span>' + escapeHtml(dir.name) + '</span>';
        
        const toggleIcon = item.querySelector(".dest-tree-toggle");
        toggleIcon.addEventListener("click", function(e) {
            e.stopPropagation();
            toggleDestFolder(dir.path, item);
        });
        
        item.addEventListener("click", function() {
            document.querySelectorAll(".dest-tree-item.selected").forEach(i => i.classList.remove("selected"));
            item.classList.add("selected");
            toggleDestFolder(dir.path, item);
        });
        
        // 单击展开/折叠（与toggle图标效果一致）
        
        container.appendChild(item);
        
        if (isExpanded) {
            const childrenContainer = document.createElement("div");
            childrenContainer.className = "dest-tree-children";
            childrenContainer.style.paddingLeft = "20px";
            container.appendChild(childrenContainer);
            
            apiCall(`/api/list?path=${encodeURIComponent(dir.path)}`)
                .then(data => {
                    if (data.success) {
                        renderDestinationTreeChildren(data.data.files, childrenContainer, dir.path);
                    }
                })
                .catch(() => {});
        }
    });
}

function toggleDestFolder(path, item) {
    if (destExpandedPaths.has(path)) {
        destExpandedPaths.delete(path);
        const toggleIcon = item.querySelector(".dest-tree-toggle");
        toggleIcon.classList.remove("expanded");
        // 移除子目录
        let nextSibling = item.nextElementSibling;
        while (nextSibling && nextSibling.classList.contains("dest-tree-children")) {
            nextSibling.remove();
            nextSibling = item.nextElementSibling;
        }
    } else {
        destExpandedPaths.add(path);
        const toggleIcon = item.querySelector(".dest-tree-toggle");
        toggleIcon.classList.add("expanded");
        // 加载子目录
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "dest-tree-children";
        childrenContainer.style.paddingLeft = "20px";
        item.insertAdjacentElement("afterend", childrenContainer);
        
        apiCall(`/api/list?path=${encodeURIComponent(path)}`)
            .then(data => {
                if (data.success) {
                    renderDestinationTreeChildren(data.data.files, childrenContainer, path);
                }
            })
            .catch(() => {});
    }
}

function updateDestBreadcrumb() {
    const breadcrumb = document.getElementById("dest-breadcrumb");
    const parts = destCurrentPath.split("/").filter(p => p);
    
    let html = '<div class="dest-breadcrumb-item' + (destCurrentPath === "/" ? " active" : "") + '" data-path="/"><i class="fas fa-home"></i></div>';
    
    let currentPath = "";
    parts.forEach((part, index) => {
        currentPath += "/" + part;
        const isLast = index === parts.length - 1;
        html += '<i class="fas fa-chevron-right dest-breadcrumb-separator"></i>';
        html += '<div class="dest-breadcrumb-item' + (isLast ? " active" : "") + '" data-path="' + currentPath + '">' + escapeHtml(part) + '</div>';
    });
    
    breadcrumb.innerHTML = html;
    
    // 绑定点击事件
    breadcrumb.querySelectorAll(".dest-breadcrumb-item").forEach(item => {
        item.addEventListener("click", function() {
            const path = this.dataset.path;
            loadDestinationPath(path);
        });
    });
}

function searchDestDirectories() {
    const query = document.getElementById("dest-search-input").value.trim().toLowerCase();
    destSearchQuery = query;
    
    if (!query) {
        loadDestinationPath(destCurrentPath);
        return;
    }
    
    // 递归搜索所有目录
    searchDestRecursive("/", query, []);
}

function searchDestRecursive(path, query, results) {
    apiCall(`/api/list?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (!data.success) return;
            
            const dirs = data.data.files.filter(f => f.isDir);
            
            dirs.forEach(dir => {
                if (dir.name.toLowerCase().includes(query)) {
                    results.push(dir);
                }
                // 继续搜索子目录
                searchDestRecursive(dir.path, query, results);
            });
            
            // 如果是根目录调用，显示结果
            if (path === "/") {
                renderDestSearchResults(results);
            }
        })
        .catch(() => {});
}

function renderDestSearchResults(results) {
    const container = document.getElementById("destination-tree");
    container.innerHTML = "";
    
    if (results.length === 0) {
        container.innerHTML = '<div class="dest-empty">未找到匹配的目录</div>';
        return;
    }
    
    results.forEach(dir => {
        const item = document.createElement("div");
        item.className = "dest-tree-item";
        item.dataset.path = dir.path;
        
        // 显示完整路径
        const pathParts = dir.path.split("/").filter(p => p);
        const pathDisplay = pathParts.join(" / ");
        
        item.innerHTML =
            '<i class="fas fa-folder dest-tree-icon"></i>' +
            '<span>' + escapeHtml(pathDisplay) + '</span>';
        
        item.addEventListener("click", function() {
            document.querySelectorAll(".dest-tree-item.selected").forEach(i => i.classList.remove("selected"));
            item.classList.add("selected");
        });
        
        container.appendChild(item);
    });
}

function moveOrCopyFile() {
    // 权限验证：只有管理员可以移动/复制文件
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以移动或复制文件', 'error');
        return;
    }

    if (selectedFiles.length === 0) return;

    const selectedItem = document.querySelector(".dest-tree-item.selected");
    if (!selectedItem) {
        showToast("请选择目标目录", "error");
        return;
    }

    const destPath = selectedItem.dataset.path;
    const api = clipboard.action === "move" ? "/api/move" : "/api/copy";
    const isMulti = clipboard.sourcePaths.length > 1;

    const body = isMulti
        ? JSON.stringify({ sourcePaths: clipboard.sourcePaths, destinationPath: destPath })
        : JSON.stringify({ sourcePath: clipboard.sourcePaths[0], destinationPath: destPath });

    apiCall(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body
    })
    .then(data => {
        if (data.success) {
            loadFiles(currentPath);
            loadTree();
            calculateStorage();
            const actionText = clipboard.action === "move" ? "移动" : "复制";
            if (isMulti) {
                const result = data.data;
                if (result.failedCount > 0) {
                    showToast(`已${actionText} ${result[clipboard.action === "move" ? "movedCount" : "copiedCount"]}/${result.totalCount} 个项目，${result.failedCount} 个失败`, "warning");
                } else {
                    showToast(`已${actionText} ${result.totalCount} 个项目`, "success");
                }
            } else {
                showToast(`${actionText}成功`, "success");
            }
            clearSelection();
            closeModal("move-copy-modal");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        showToast("操作失败", "error");
    });
}

// ===== 文件打开逻辑 =====
// 判断文件是否支持在线预览
function canPreviewFile(name) {
    // 无扩展名的文件视为可预览（以文本方式）
    if (!name.includes(".")) return true;
    const ext = name.split(".").pop().toLowerCase();
    const previewableExts = [
        "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif", "avif",
        "mp4", "webm", "ogg", "mov", "avi", "mkv",
        "mp3", "wav", "flac", "aac", "m4a", "wma",
        "pdf",
        "md", "markdown",
        "txt", "html", "htm", "css", "js", "ts", "json", "xml", "csv",
        "py", "java", "go", "c", "cpp", "h", "hpp", "cs", "rs", "swift",
        "php", "rb", "sql", "sh", "bash", "zsh", "bat", "ps1",
        "yml", "yaml", "toml", "ini", "cfg", "conf", "env", "properties",
        "log", "diff", "patch", "vue", "jsx", "tsx", "svelte",
        "scss", "sass", "less", "r", "lua", "pl", "ex", "exs", "erl",
        "clj", "hs", "ml", "fs", "dart", "kt", "scala"
    ];
    return previewableExts.includes(ext);
}

// 双击打开文件：统一走预览
function openFile(path, name) {
    previewFile(path, name);
}

// ===== 右键菜单 =====
function showContextMenu(x, y, file) {
    const contextMenu = document.getElementById("context-menu");
    contextMenu.classList.add("active");

    // 确保菜单不超出屏幕
    const menuWidth = 200;
    const menuHeight = 300;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";

    const isMulti = selectedFiles.length > 1;
    const isLoggedIn = currentUser !== null;
    const isAdmin = currentUser && (currentUser.type === 'root' || currentUser.type === 'admin');
    const openItem = contextMenu.querySelector('[data-action="open"]');
    const previewItem = contextMenu.querySelector('[data-action="preview"]');
    const editItem = contextMenu.querySelector('[data-action="edit"]');
    const downloadItem = contextMenu.querySelector('[data-action="download"]');
    const renameItem = contextMenu.querySelector('[data-action="rename"]');
    const copyItem = contextMenu.querySelector('[data-action="copy"]');
    const moveItem = contextMenu.querySelector('[data-action="move"]');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    const dividers = contextMenu.querySelectorAll('.context-menu-divider');

    // 辅助函数：设置菜单项的权限状态
    function setItemAuth(item, hasPermission, deniedMsg) {
        item.style.display = "flex";
        if (hasPermission) {
            item.classList.remove('context-menu-disabled');
            item.removeAttribute('data-auth-denied');
        } else {
            item.classList.add('context-menu-disabled');
            item.setAttribute('data-auth-denied', deniedMsg || '权限不足');
        }
    }

    if (isMulti) {
        // 多选模式：隐藏单文件操作，显示批量操作
        openItem.style.display = "none";
        previewItem.style.display = "none";
        editItem.style.display = "none";
        renameItem.style.display = "none";
        downloadItem.style.display = "flex";
        downloadItem.classList.remove('context-menu-disabled');
        downloadItem.removeAttribute('data-auth-denied');
        downloadItem.querySelector("span").textContent = "批量下载";
        setItemAuth(copyItem, isAdmin, '只有管理员可以复制文件');
        setItemAuth(moveItem, isAdmin, '只有管理员可以移动文件');
        setItemAuth(deleteItem, isAdmin, '只有管理员可以删除文件');
        copyItem.querySelector("span").textContent = "批量复制";
        moveItem.querySelector("span").textContent = "批量移动";
        deleteItem.querySelector("span").textContent = "批量删除";
    } else {
        openItem.style.display = file.isDir ? "flex" : "none";
        openItem.classList.remove('context-menu-disabled');
        previewItem.style.display = file.isDir ? "none" : "flex";
        previewItem.classList.remove('context-menu-disabled');
        const canEdit = !file.isDir && (isEditableFile(file.name) || !file.name.includes("."));
        setItemAuth(editItem, isAdmin && canEdit, '只有管理员可以编辑文件');
        setItemAuth(renameItem, isAdmin, '只有管理员可以重命名文件');
        downloadItem.style.display = "flex";
        downloadItem.classList.remove('context-menu-disabled');
        downloadItem.removeAttribute('data-auth-denied');
        downloadItem.querySelector("span").textContent = file.isDir ? "下载目录" : "下载";
        setItemAuth(copyItem, isAdmin, '只有管理员可以复制文件');
        setItemAuth(moveItem, isAdmin, '只有管理员可以移动文件');
        setItemAuth(deleteItem, isAdmin, '只有管理员可以删除文件');
        copyItem.querySelector("span").textContent = "复制";
        moveItem.querySelector("span").textContent = "移动";
        deleteItem.querySelector("span").textContent = "删除";
    }

    // 分隔线始终显示
    dividers.forEach(div => {
        div.style.display = '';
    });
}

function hideContextMenu() {
    document.getElementById("context-menu").classList.remove("active");
}

function handleContextMenuAction(action) {
    if (selectedFiles.length === 0) return;

    // 检查当前点击的菜单项是否被禁用
    var clickedItem = document.querySelector('#context-menu .context-menu-item[data-action="' + action + '"]');
    if (clickedItem && clickedItem.classList.contains('context-menu-disabled')) {
        var deniedMsg = clickedItem.getAttribute('data-auth-denied') || '权限不足';
        showToast(deniedMsg, 'error');
        hideContextMenu();
        return;
    }

    const isMulti = selectedFiles.length > 1;

    switch (action) {
        case "open":
            if (selectedFile.isDir) {
                loadFiles(selectedFile.path);
            } else {
                openFile(selectedFile.path, selectedFile.name);
            }
            break;
        case "preview":
            if (!selectedFile.isDir) previewFile(selectedFile.path, selectedFile.name);
            break;
        case "edit":
            if (!selectedFile.isDir) editFile(selectedFile.path, selectedFile.name);
            break;
        case "download":
            downloadSelectedFiles();
            break;
        case "copy":
            clipboard = { action: "copy", sourcePaths: selectedFiles.map(f => f.path) };
            openMoveCopyModal();
            break;
        case "move":
            clipboard = { action: "move", sourcePaths: selectedFiles.map(f => f.path) };
            openMoveCopyModal();
            break;
        case "rename":
            openRenameModal();
            break;
        case "delete":
            if (isMulti) {
                batchDeleteFiles(selectedFiles.map(f => f.path));
            } else {
                deleteFile(selectedFile.path);
            }
            break;
    }
    hideContextMenu();
}

// ===== 音频播放 =====
function playAudio(url, name, path) {
    const audioPlayer = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');
    const audioTitle = document.getElementById('audio-player-title');
    const audioArtist = document.getElementById('audio-player-artist');

    // 显示播放器
    audioPlayer.style.display = 'flex';

    // 获取当前文件夹的所有音频文件
    const currentDir = path.substring(0, path.lastIndexOf('/')) || '/';
    loadFolderAudioFiles(currentDir, path);

    // 设置音频源和标题
    audioElement.src = url;
    audioTitle.textContent = name;

    // 尝试从文件名中提取歌手信息
    const artistMatch = name.match(/^(.+?)\s*[-–]\s*.+$/);
    if (artistMatch) {
        audioArtist.textContent = artistMatch[1];
    } else {
        audioArtist.textContent = '未知艺术家';
    }

    // 播放音频
    audioElement.play().catch(err => {
        console.error('播放失败:', err);
        showToast('音频播放失败，请检查文件格式', 'error');
    });
}

// 加载当前文件夹的音频文件到播放列表
function loadFolderAudioFiles(dirPath, currentPath) {
    // 清空播放列表
    audioPlaylist = [];

    // 使用currentAllFiles获取当前文件夹的所有音频文件
    if (currentAllFiles && currentAllFiles.length > 0) {
        currentAllFiles.forEach(file => {
            if (!file.isDir) {
                const fileExt = file.name.split('.').pop().toLowerCase();

                // 检查是否是音频文件
                if (audioExts.includes(fileExt)) {
                    // 构建预览URL
                    const previewUrl = `${API_BASE}/api/preview?path=${encodeURIComponent(file.path)}` + 
                                     (authToken ? '&token=' + encodeURIComponent(authToken) : '');

                    audioPlaylist.push({
                        path: file.path,
                        name: file.name,
                        url: previewUrl
                    });
                }
            }
        });
    }

    // 找到当前播放的音频索引
    currentAudioIndex = audioPlaylist.findIndex(item => item.path === currentPath);
}

// 关闭音频播放器
function closeAudioPlayer() {
    const audioPlayer = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');

    // 停止播放
    audioElement.pause();
    audioElement.src = '';

    // 隐藏播放器
    audioPlayer.style.display = 'none';

    // 清空播放列表
    audioPlaylist = [];
    currentAudioIndex = -1;
}

// 初始化音频播放器事件
function initAudioPlayer() {
    const audioElement = document.getElementById('audio-element');
    const closeBtn = document.getElementById('audio-player-close');
    const playlistBtn = document.getElementById('audio-player-playlist');
    const modeBtn = document.getElementById('audio-player-mode');
    const playBtn = document.getElementById('audio-player-play');
    const prevBtn = document.getElementById('audio-player-prev');
    const nextBtn = document.getElementById('audio-player-next');
    const volumeBtn = document.getElementById('audio-player-volume');
    const volumeInput = document.getElementById('audio-volume-input');
    const progressInput = document.getElementById('audio-progress-input');

    // 关闭按钮事件
    closeBtn.addEventListener('click', closeAudioPlayer);

    // 播放列表按钮事件
    playlistBtn.addEventListener('click', function() {
        const dropdown = document.getElementById('audio-player-dropdown');
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            updatePlaylistDropdown();
        }
    });

    // 关闭下拉菜单按钮事件
    document.getElementById('audio-player-dropdown-close').addEventListener('click', function() {
        document.getElementById('audio-player-dropdown').classList.remove('show');
    });

    // 点击下拉菜单外部关闭
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('audio-player-dropdown');
        const playlistBtn = document.getElementById('audio-player-playlist');
        if (!dropdown.contains(e.target) && !playlistBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // 关闭下拉菜单按钮事件
    document.getElementById('audio-player-dropdown-close').addEventListener('click', function() {
        document.getElementById('audio-player-dropdown').classList.remove('show');
    });

    // 点击下拉菜单外部关闭
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('audio-player-dropdown');
        const playlistBtn = document.getElementById('audio-player-playlist');
        if (!dropdown.contains(e.target) && !playlistBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // 播放模式按钮事件
    modeBtn.addEventListener('click', togglePlayMode);

    // 播放/暂停按钮事件
    playBtn.addEventListener('click', togglePlayPause);

    // 上一首按钮事件
    prevBtn.addEventListener('click', playPrevAudio);

    // 下一首按钮事件
    nextBtn.addEventListener('click', playNextAudio);

    // 音量按钮事件
    volumeBtn.addEventListener('click', toggleMute);

    // 音量滑块事件
    volumeInput.addEventListener('input', function() {
        audioElement.volume = this.value / 100;
        updateVolumeIcon(audioElement.volume);
    });

    // 进度条事件
    progressInput.addEventListener('input', function() {
        const time = (this.value / 100) * audioElement.duration;
        audioElement.currentTime = time;
    });

    // 音频时间更新事件
    audioElement.addEventListener('timeupdate', updateProgress);

    // 音频加载完成事件
    audioElement.addEventListener('loadedmetadata', function() {
        document.getElementById('audio-total-time').textContent = formatTime(audioElement.duration);
    });

    // 音频播放结束事件
    audioElement.addEventListener('ended', function() {
        playNextAudio();
    });

    // 音频播放状态变化事件
    audioElement.addEventListener('play', function() {
        playBtn.querySelector('i').className = 'fas fa-pause';
    });

    audioElement.addEventListener('pause', function() {
        playBtn.querySelector('i').className = 'fas fa-play';
    });
}

// 格式化时间
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 更新进度条
function updateProgress() {
    const audioElement = document.getElementById('audio-element');
    const progressInput = document.getElementById('audio-progress-input');
    const progressFilled = document.getElementById('audio-progress-filled');
    const currentTimeEl = document.getElementById('audio-current-time');

    if (audioElement.duration) {
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        progressInput.value = progress;
        progressFilled.style.width = progress + '%';
        currentTimeEl.textContent = formatTime(audioElement.currentTime);
    }
}

// 切换播放/暂停
function togglePlayPause() {
    const audioElement = document.getElementById('audio-element');
    if (audioElement.paused) {
        audioElement.play();
    } else {
        audioElement.pause();
    }
}

// 播放上一首
function playPrevAudio() {
    if (audioPlaylist.length === 0) return;

    let prevIndex;

    switch(audioPlayMode) {
        case 'random':
            // 随机选择一个不等于当前索引的索引
            do {
                prevIndex = Math.floor(Math.random() * audioPlaylist.length);
            } while (prevIndex === currentAudioIndex && audioPlaylist.length > 1);
            break;
        case 'loop':
            // 循环播放当前歌曲
            prevIndex = currentAudioIndex;
            break;
        case 'sequential':
        default:
            // 顺序播放上一首
            prevIndex = (currentAudioIndex - 1 + audioPlaylist.length) % audioPlaylist.length;
            break;
    }

    const prevAudio = audioPlaylist[prevIndex];
    playAudio(prevAudio.url, prevAudio.name, prevAudio.path);
}

// 更新音量图标
function updateVolumeIcon(volume) {
    const volumeBtn = document.getElementById('audio-player-volume');
    const icon = volumeBtn.querySelector('i');

    if (volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume < 0.5) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

// 切换静音
function toggleMute() {
    const audioElement = document.getElementById('audio-element');
    const volumeInput = document.getElementById('audio-volume-input');

    if (audioElement.volume > 0) {
        audioElement.dataset.prevVolume = audioElement.volume;
        audioElement.volume = 0;
        volumeInput.value = 0;
    } else {
        const prevVolume = parseFloat(audioElement.dataset.prevVolume) || 1;
        audioElement.volume = prevVolume;
        volumeInput.value = prevVolume * 100;
    }

    updateVolumeIcon(audioElement.volume);
}

// 切换播放模式
function togglePlayMode() {
    const modeBtn = document.getElementById('audio-player-mode');
    const modes = ['sequential', 'random', 'loop'];
    const currentIndex = modes.indexOf(audioPlayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    audioPlayMode = modes[nextIndex];

    // 更新按钮图标和状态
    modeBtn.dataset.mode = audioPlayMode;
    modeBtn.classList.add('active');

    // 更新图标
    const icon = modeBtn.querySelector('i');
    switch(audioPlayMode) {
        case 'sequential':
            icon.className = 'fas fa-retweet';
            showToast('顺序播放', 'info');
            break;
        case 'random':
            icon.className = 'fas fa-random';
            showToast('随机播放', 'info');
            break;
        case 'loop':
            icon.className = 'fas fa-redo';
            showToast('循环播放', 'info');
            break;
    }
}

// 播放下一首
function playNextAudio() {
    if (audioPlaylist.length === 0) return;

    let nextIndex;

    switch(audioPlayMode) {
        case 'random':
            // 随机选择一个不等于当前索引的索引
            do {
                nextIndex = Math.floor(Math.random() * audioPlaylist.length);
            } while (nextIndex === currentAudioIndex && audioPlaylist.length > 1);
            break;
        case 'loop':
            // 循环播放当前歌曲
            nextIndex = currentAudioIndex;
            break;
        case 'sequential':
        default:
            // 顺序播放下一首
            nextIndex = (currentAudioIndex + 1) % audioPlaylist.length;
            if (nextIndex === 0 && currentAudioIndex !== -1) {
                // 已经播放到最后一首，停止播放
                return;
            }
            break;
    }

    const nextAudio = audioPlaylist[nextIndex];
    playAudio(nextAudio.url, nextAudio.name, nextAudio.path);
}

// 显示播放列表
function showPlaylist() {
    if (audioPlaylist.length === 0) {
        showToast('播放列表为空', 'info');
        return;
    }

    let playlistHtml = '<div style="padding: 16px; max-height: 400px; overflow-y: auto;">';
    playlistHtml += '<h3 style="margin: 0 0 16px 0; font-size: 16px;">播放列表</h3>';

    audioPlaylist.forEach((item, index) => {
        const isCurrent = index === currentAudioIndex;
        playlistHtml += `
            <div class="playlist-item ${isCurrent ? 'active' : ''}" 
                 style="padding: 8px 12px; margin-bottom: 8px; cursor: pointer; 
                        border-radius: 4px; background: ${isCurrent ? 'var(--primary-light)' : 'var(--bg-card)'}; 
                        display: flex; align-items: center; gap: 8px;"
                 onclick="playAudioFromPlaylist(${index})">
                <i class="fas ${isCurrent ? 'fa-play' : 'fa-music'}" 
                   style="color: ${isCurrent ? 'var(--primary)' : 'var(--text-secondary)'}; width: 16px;"></i>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; 
                             color: ${isCurrent ? 'var(--primary)' : 'var(--text-primary)'};">${escapeHtml(item.name)}</span>
            </div>
        `;
    });

    playlistHtml += '</div>';

    // 使用现有的模态框显示播放列表
    const modal = document.getElementById('preview-modal');

    // 如果模态框已经打开，则关闭它
    if (modal.style.display === 'flex') {
        closeModal('preview-modal');
        return;
    }

    const body = document.getElementById('preview-body');
    const title = document.getElementById('preview-title');

    title.textContent = '播放列表';
    body.innerHTML = playlistHtml;
    openModal('preview-modal');
}

// 更新播放列表下拉菜单
function updatePlaylistDropdown() {
    const dropdownBody = document.getElementById('audio-player-dropdown-body');

    if (audioPlaylist.length === 0) {
        dropdownBody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">播放列表为空</div>';
        return;
    }

    let html = '';
    audioPlaylist.forEach((item, index) => {
        const isCurrent = index === currentAudioIndex;
        html += `
            <div class="audio-player-dropdown-item ${isCurrent ? 'active' : ''}" onclick="playAudioFromPlaylist(${index})">
                <div class="audio-player-dropdown-item-icon">
                    <i class="fas ${isCurrent ? 'fa-play' : 'fa-music'}"></i>
                </div>
                <div class="audio-player-dropdown-item-name">${escapeHtml(item.name)}</div>
            </div>
        `;
    });

    dropdownBody.innerHTML = html;
}

// 从播放列表播放
function playAudioFromPlaylist(index) {
    const item = audioPlaylist[index];
    if (item) {
        playAudio(item.url, item.name, item.path);
        closeModal('preview-modal');
        document.getElementById('audio-player-dropdown').classList.remove('show');
    }
}

// ===== 文件预览 =====
function previewFile(path, name) {
    const ext = name.split(".").pop().toLowerCase();
    const previewUrl = `${API_BASE}/api/preview?path=${encodeURIComponent(path)}` + (authToken ? '&token=' + encodeURIComponent(authToken) : '');
    const downloadUrl = `${API_BASE}/api/download?path=${encodeURIComponent(path)}` + (authToken ? '&token=' + encodeURIComponent(authToken) : '');

    const hasExt = name.includes(".");
    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif", "avif"];
    const videoExts = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
    const videoPreviewExts = ["mp4", "webm", "ogg"];
    const pdfExts = ["pdf"];
    const officeExts = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
    const markdownExts = ["md", "markdown"];
    const textExts = [
        "txt", "html", "htm", "css", "js", "ts", "json", "xml", "csv",
        "py", "java", "go", "c", "cpp", "h", "hpp", "cs", "rs", "swift",
        "php", "rb", "sql", "sh", "bash", "zsh", "bat", "ps1",
        "yml", "yaml", "toml", "ini", "cfg", "conf", "env", "properties",
        "log", "diff", "patch", "vue", "jsx", "tsx", "svelte",
        "scss", "sass", "less", "r", "lua", "pl", "ex", "exs", "erl",
        "clj", "hs", "ml", "fs", "dart", "kt", "scala"
    ];

    const modal = document.getElementById("preview-modal");
    const body = document.getElementById("preview-body");
    const title = document.getElementById("preview-title");
    const dlBtn = document.getElementById("preview-download-btn");

    title.textContent = name;
    body.innerHTML = "";
    dlBtn.onclick = function() { window.location.href = downloadUrl; };

    // 确保恢复预览模式UI
    var titleIcon = modal.querySelector(".preview-title i");
    var editorBody = document.getElementById("editor-body");
    var saveBtn = document.getElementById("editor-save-btn");
    var lineCol = document.getElementById("editor-line-col");
    var fileSizeEl = document.getElementById("editor-file-size");
    var fileInfoEl = document.getElementById("preview-file-info");
    var downloadBtn = document.getElementById("preview-download-btn");
    if (titleIcon) titleIcon.className = "fas fa-eye";
    if (editorBody) editorBody.style.display = "none";
    if (saveBtn) saveBtn.style.display = "none";
    if (downloadBtn) downloadBtn.style.display = "";
    if (fileInfoEl) fileInfoEl.style.display = "";
    if (lineCol) lineCol.style.display = "none";
    if (fileSizeEl) fileSizeEl.style.display = "none";

    // 非图片预览时重置容器尺寸和位置（图片预览会自适应调整，切换时保持当前尺寸避免闪烁）
    var pContainer = modal.querySelector(".preview-container");
    var isImage = imageExts.includes(ext);
    if (pContainer && !isImage) {
        pContainer.style.position = "";
        pContainer.style.transform = "";
        pContainer.style.left = "";
        pContainer.style.top = "";
        pContainer.style.margin = "";
        pContainer.style.width = "";
        pContainer.style.height = "";
    }

    // 更新底部状态栏
    const fileInfo = document.getElementById("preview-file-info");
    if (fileInfo) {
        const typeLabels = {
            image: "图片", video: "视频", audio: "音频", pdf: "PDF文档",
            office: "Office文档", markdown: "Markdown", text: "文本文件"
        };
        let fileType = "文件";
        if (imageExts.includes(ext)) fileType = typeLabels.image;
        else if (videoExts.includes(ext)) fileType = typeLabels.video;
        else if (audioExts.includes(ext)) fileType = typeLabels.audio;
        else if (pdfExts.includes(ext)) fileType = typeLabels.pdf;
        else if (officeExts.includes(ext)) fileType = typeLabels.office;
        else if (markdownExts.includes(ext)) fileType = typeLabels.markdown;
        else if (textExts.includes(ext)) fileType = typeLabels.text;
        fileInfo.innerHTML = '<i class="fas fa-file"></i> ' + escapeHtml(name) + ' &nbsp;·&nbsp; ' + fileType;
    }

    if (imageExts.includes(ext)) {
        // 更新当前图片索引
        currentImageIndex = currentImageList.findIndex(f => f.path === path);

        const img = document.createElement("img");
        img.alt = name;
        // 通过URL附加token参数解决img标签无法携带Authorization header的问题
        img.src = authToken ? previewUrl + '&token=' + encodeURIComponent(authToken) : previewUrl;
        img.onerror = function() {
            const errDiv = document.createElement("div");
            errDiv.className = "preview-office";
            errDiv.innerHTML =
                '<i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--danger);margin-bottom:16px"></i>' +
                '<p style="color:var(--text-secondary)">图片加载失败</p>' +
                '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                '<a href="' + downloadUrl + '" style="display:inline-block;margin-top:16px;padding:8px 20px;background:var(--primary);color:#fff;border-radius:8px;text-decoration:none;font-size:13px"><i class="fas fa-download"></i> 下载文件</a>';
            body.innerHTML = "";
            body.appendChild(errDiv);
        };
        body.appendChild(img);

        // 图片加载后填充窗口
        img.onload = function() {
            var container = modal.querySelector(".preview-container");
            if (!container) return;
            // 预览框默认已填充窗口，无需额外调整尺寸
        };

        // 添加鼠标滚轮切换图片功能
        modal.onwheel = function(e) {
            e.preventDefault();
            if (e.deltaY > 0) {
                navigateNextImage();
            } else {
                navigatePrevImage();
            }
        };
    } else if (videoExts.includes(ext)) {
        if (videoPreviewExts.includes(ext)) {
            const video = document.createElement("video");
            // 通过URL附加token参数解决video标签无法携带Authorization header的问题
            video.src = authToken ? previewUrl + '&token=' + encodeURIComponent(authToken) : previewUrl;
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;
            video.style.width = "100%";
            video.style.maxHeight = "100%";
            video.style.objectFit = "contain";
        
            // 视频加载失败时显示错误提示
            video.addEventListener('error', function() {
                const errDiv = document.createElement("div");
                errDiv.className = "preview-office";
                errDiv.innerHTML =
                    '<i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--danger);margin-bottom:16px"></i>' +
                    '<p style="color:var(--text-secondary)">视频无法播放</p>' +
                    '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                    '<p style="color:var(--text-muted);font-size:12px;margin-top:12px;line-height:1.6">可能原因：视频编码格式不被浏览器支持<br>浏览器仅支持 H.264 编码的 MP4 文件<br>请尝试使用视频转换工具将视频转为 H.264 编码</p>' +
                    '<a href="' + downloadUrl + '" style="display:inline-block;margin-top:16px;padding:8px 20px;background:var(--primary);color:#fff;border-radius:8px;text-decoration:none;font-size:13px"><i class="fas fa-download"></i> 下载文件</a>';
                body.innerHTML = "";
                body.appendChild(errDiv);
            });
        
        
        
            body.appendChild(video);
        } else {
            // 不支持浏览器预览的视频格式，直接显示下载提示
            const unsupportedDiv = document.createElement("div");
            unsupportedDiv.className = "preview-office";
            unsupportedDiv.innerHTML =
                '<i class="fas fa-file-video" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>' +
                '<p style="color:var(--text-secondary)">该视频格式不支持浏览器预览</p>' +
                '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                '<p style="color:var(--text-muted);font-size:12px;margin-top:12px;line-height:1.6">浏览器仅支持 H.264 编码的 MP4 文件<br>.' + escapeHtml(ext.toUpperCase()) + ' 格式请下载后使用本地播放器查看</p>' +
                '<a href="' + downloadUrl + '" style="display:inline-block;margin-top:16px;padding:8px 20px;background:var(--primary);color:#fff;border-radius:8px;text-decoration:none;font-size:13px"><i class="fas fa-download"></i> 下载文件</a>';
            body.appendChild(unsupportedDiv);
        }
    } else if (audioExts.includes(ext)) {
        // 使用独立的音频播放器
        playAudio(previewUrl, name, path);
        return;
    } else if (pdfExts.includes(ext)) {
        const iframe = document.createElement("iframe");
        // 通过URL附加token参数解决iframe无法携带Authorization header的问题
        iframe.src = authToken ? previewUrl + '&token=' + encodeURIComponent(authToken) : previewUrl;
        body.appendChild(iframe);
    } else if (officeExts.includes(ext)) {
        // 使用微软 Office Online Viewer 在线预览 Office 文件
        // Office在线预览需要公网可访问的URL，附加token参数以通过认证
        const fullPreviewUrl = window.location.origin + previewUrl + (authToken ? '&token=' + encodeURIComponent(authToken) : '');
        const iframe = document.createElement("iframe");
        iframe.src = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(fullPreviewUrl);
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "var(--radius-sm)";
        iframe.style.flex = "1";
        // iframe 加载失败时显示提示
        iframe.addEventListener("error", function() {
            body.innerHTML = '<div class="preview-office">' +
                '<i class="fas fa-file-alt" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>' +
                '<p style="color:var(--text-secondary)">Office 文件预览加载失败</p>' +
                '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                '<a href="' + downloadUrl + '" style="display:inline-block;margin-top:16px;padding:8px 20px;background:var(--primary);color:#fff;border-radius:8px;text-decoration:none;font-size:13px"><i class="fas fa-download"></i> 下载文件</a>' +
                '</div>';
        });
        body.appendChild(iframe);
    } else if (markdownExts.includes(ext)) {
        authFetch(previewUrl.replace(API_BASE, ''))
            .then(r => {
                if (!r.ok) {
                    throw new Error('文件加载失败');
                }
                return r.text();
            })
            .then(text => {
                const div = document.createElement("div");
                div.className = "markdown-body";
                div.innerHTML = simpleMarkdown(text);
                body.appendChild(div);
            })
            .catch(err => {
                body.innerHTML = '<div class="preview-error">' +
                    '<i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--danger);margin-bottom:16px"></i>' +
                    '<p style="color:var(--text-secondary)">Markdown文件加载失败，可能文件过大</p>' +
                    '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                    '</div>';
            });
    } else if (textExts.includes(ext) || !hasExt) {
        // 已知文本扩展名或无扩展名文件，以文本方式预览
        authFetch(previewUrl.replace(API_BASE, ''))
            .then(r => {
                if (!r.ok) {
                    throw new Error('文件加载失败');
                }
                return r.text();
            })
            .then(text => {
                const pre = document.createElement("pre");
                pre.className = "code-preview";
                
                // 尝试使用highlight.js进行语法高亮
                if (typeof hljs !== "undefined") {
                    // 根据文件扩展名猜测语言
                    const language = hljs.getLanguage(ext) ? ext : 'plaintext';
                    const highlighted = hljs.highlight(text, { language: language }).value;
                    pre.innerHTML = highlighted;
                } else {
                    pre.textContent = text;
                }
                
                body.appendChild(pre);
            })
            .catch(err => {
                body.innerHTML = '<div class="preview-error">' +
                    '<i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--danger);margin-bottom:16px"></i>' +
                    '<p style="color:var(--text-secondary)">文本文件加载失败，可能文件过大</p>' +
                    '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>' +
                    '</div>';
            });
    } else {
        const div = document.createElement("div");
        div.className = "preview-office";
        div.innerHTML =
            '<i class="fas fa-file" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>' +
            '<p style="color:var(--text-secondary)">此文件不支持在线预览</p>' +
            '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">' + escapeHtml(name) + '</p>';
        body.appendChild(div);
    }

    openModal("preview-modal");
}

function closePreview() {
    // 如果在编辑模式下，使用closeEditor检查未保存状态
    var editorBody = document.getElementById("editor-body");
    if (editorBody && editorBody.style.display !== "none") {
        closeEditor();
        return;
    }
    const modal = document.getElementById("preview-modal");
    const body = document.getElementById("preview-body");
    // 停止视频/音频播放
    const media = body.querySelector("video, audio");
    if (media) media.pause();
    body.innerHTML = "";
    // 移除滚轮事件监听器
    modal.onwheel = null;
    // 重置容器位置和大小
    const container = modal ? modal.querySelector(".preview-container") : null;
    if (container) {
        container.classList.remove("preview-fullscreen");
        container.style.position = "";
        container.style.transform = "";
        container.style.left = "";
        container.style.top = "";
        container.style.margin = "";
        container.style.width = "";
        container.style.height = "";
    }
    // 重置全屏按钮状态
    var fsBtn = document.getElementById("preview-fullscreen-btn");
    if (fsBtn) {
        var icon = fsBtn.querySelector("i");
        var label = fsBtn.querySelector("span");
        if (icon) icon.className = "fas fa-expand";
        if (label) label.textContent = "全屏";
    }
    closeModal("preview-modal");
}

// 切换到上一张图片
function navigatePrevImage() {
    if (currentImageList.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentImageList.length) % currentImageList.length;
    const file = currentImageList[currentImageIndex];
    previewFile(file.path, file.name);
}

// 切换到下一张图片
function navigateNextImage() {
    if (currentImageList.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentImageList.length;
    const file = currentImageList[currentImageIndex];
    previewFile(file.path, file.name);
}

// ===== 简易 Markdown 渲染 =====
function simpleMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

// ===== 文件编辑器 =====
// 更新编辑器代码高亮
function updateEditorHighlight() {
    var textarea = document.getElementById("editor-textarea");
    var highlight = document.getElementById("editor-highlight");
    if (!textarea || !highlight) return;
    var code = textarea.value + "\n";
    if (typeof hljs !== "undefined") {
        var result = hljs.highlightAuto(code);
        highlight.innerHTML = result.value;
    } else {
        highlight.textContent = code;
    }
}

function editFile(path, name) {
    // 权限验证：只有管理员可以编辑文件
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以编辑文件', 'error');
        return;
    }

    const textarea = document.getElementById("editor-textarea");
    const title = document.getElementById("preview-title");
    const titleIcon = document.querySelector(".preview-title i");
    const previewBody = document.getElementById("preview-body");
    const editorBody = document.getElementById("editor-body");
    const saveBtn = document.getElementById("editor-save-btn");
    const lineCol = document.getElementById("editor-line-col");
    const fileSize = document.getElementById("editor-file-size");
    const fileInfo = document.getElementById("preview-file-info");
    const downloadBtn = document.getElementById("preview-download-btn");

    // 切换到编辑模式
    title.textContent = name;
    if (titleIcon) titleIcon.className = "fas fa-edit";
    previewBody.style.display = "none";
    editorBody.style.display = "";
    saveBtn.style.display = "";
    downloadBtn.style.display = "none";
    if (fileInfo) fileInfo.style.display = "none";
    if (lineCol) lineCol.style.display = "";
    if (fileSize) fileSize.style.display = "";

    textarea.value = "加载中...";
    textarea.dataset.modified = "false";
    textarea.dataset.filePath = path;

    apiCall(`/api/file-content?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (data.success) {
                textarea.value = data.data.content;
                textarea.dataset.modified = "false";
                updateEditorStatus();
                updateEditorHighlight();
            } else {
                textarea.value = "";
                showToast(data.message, "error");
                updateEditorHighlight();
            }
        })
        .catch(error => {
            textarea.value = "";
            showToast("加载文件内容失败", "error");
            updateEditorHighlight();
        });

    openModal("preview-modal");
}

function saveFile() {
    // 权限验证：只有管理员可以保存文件
    if (!currentUser || currentUser.type !== 'admin' && currentUser.type !== 'root') {
        showToast('只有管理员可以保存文件', 'error');
        return;
    }

    const textarea = document.getElementById("editor-textarea");
    const path = textarea.dataset.filePath;
    if (!path) return;

    apiCall('/api/save-file', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path, content: textarea.value })
    })
    .then(data => {
        if (data.success) {
            textarea.dataset.modified = "false";
            showToast("文件保存成功", "success");
        } else {
            showToast(data.message, "error");
        }
    })
    .catch(error => {
        console.error("Error saving file:", error);
        showToast("保存失败", "error");
    });
}

function closeEditor(force) {
    const textarea = document.getElementById("editor-textarea");
    if (!force && textarea.dataset.modified === "true") {
        showUnsavedConfirm();
        return;
    }
    // 恢复预览模式UI
    var titleIcon = document.querySelector(".preview-title i");
    var previewBody = document.getElementById("preview-body");
    var editorBody = document.getElementById("editor-body");
    var saveBtn = document.getElementById("editor-save-btn");
    var lineCol = document.getElementById("editor-line-col");
    var fileSize = document.getElementById("editor-file-size");
    var fileInfo = document.getElementById("preview-file-info");
    var downloadBtn = document.getElementById("preview-download-btn");
    if (titleIcon) titleIcon.className = "fas fa-eye";
    if (previewBody) previewBody.style.display = "";
    if (editorBody) editorBody.style.display = "none";
    if (saveBtn) saveBtn.style.display = "none";
    if (downloadBtn) downloadBtn.style.display = "";
    if (fileInfo) fileInfo.style.display = "";
    if (lineCol) lineCol.style.display = "none";
    if (fileSize) fileSize.style.display = "none";
    closeModal("preview-modal");
}

function showUnsavedConfirm() {
    openModal("unsaved-confirm-modal");
}

function closeEditorSave() {
    saveFile();
    // 保存后直接关闭（saveFile是异步的，等待保存完成）
    const textarea = document.getElementById("editor-textarea");
    const checkSave = setInterval(function() {
        if (textarea.dataset.modified !== "true") {
            clearInterval(checkSave);
            closeEditor(true);
        }
    }, 100);
    // 超时5秒自动关闭
    setTimeout(function() { clearInterval(checkSave); }, 5000);
}

function closeEditorDiscard() {
    const textarea = document.getElementById("editor-textarea");
    textarea.dataset.modified = "false";
    closeModal("unsaved-confirm-modal");
    closeEditor(true);
}

function closeEditorCancel() {
    closeModal("unsaved-confirm-modal");
}

function updateEditorStatus() {
    const textarea = document.getElementById("editor-textarea");
    const lineCol = document.getElementById("editor-line-col");
    const fileSize = document.getElementById("editor-file-size");

    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    if (lineCol) lineCol.innerHTML = '<i class="fas fa-map-marker-alt"></i> 行 ' + line + ', 列 ' + col;
    if (fileSize) fileSize.innerHTML = '<i class="fas fa-file"></i> ' + formatFileSize(new Blob([textarea.value]).size);
}

// ===== 模态框 =====
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove("active");
        // 重置容器内联样式，避免下次打开时保留拖拽/缩放位置
        const container = modal.querySelector(".preview-container, .editor-container");
        if (container) {
            container.style.position = "";
            container.style.left = "";
            container.style.top = "";
            container.style.margin = "";
            container.style.width = "";
            container.style.height = "";
        }
        // 检查是否还有其他模态框打开
        const anyActive = document.querySelector(".modal-overlay.active");
        if (!anyActive) {
            document.body.style.overflow = "";
        }
    }
}

// ===== 窗口大小拖拽调整 =====
function initResizeHandles() {
    document.querySelectorAll("[data-resize]").forEach(function(handle) {
        var container = handle.closest(".preview-container, .editor-container");
        if (!container) return;

        var isResizing = false;
        var startX, startY, startWidth, startHeight, startLeft, startTop;
        var resizeType = handle.dataset.resize;
        var direction = resizeType.split("-").pop();

        handle.addEventListener("mousedown", function(e) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = container.offsetWidth;
            startHeight = container.offsetHeight;
            var rect = container.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // 切换为绝对定位以支持缩放
            container.style.position = "absolute";
            container.style.left = rect.left + "px";
            container.style.top = rect.top + "px";
            container.style.transform = "none";
            container.style.margin = "0";

            handle.classList.add("active");
            if (direction === "l" || direction === "r") document.body.style.cursor = "ew-resize";
            else if (direction === "t" || direction === "b") document.body.style.cursor = "ns-resize";
            else document.body.style.cursor = "nwse-resize";
            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", function(e) {
            if (!isResizing) return;

            var diffX = e.clientX - startX;
            var diffY = e.clientY - startY;
            var minWidth = 320;
            var minHeight = 300;
            var maxWidth = window.innerWidth * 0.94;
            var maxHeight = window.innerHeight * 0.94;

            // 左侧调整
            if (direction === "l" || direction === "lt" || direction === "lb") {
                var newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - diffX));
                container.style.width = newWidth + "px";
                container.style.left = (startLeft + startWidth - newWidth) + "px";
            }

            // 右侧调整
            if (direction === "r" || direction === "rt" || direction === "rb") {
                var newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diffX));
                container.style.width = newWidth + "px";
            }

            // 顶部调整
            if (direction === "t" || direction === "lt" || direction === "rt") {
                var newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - diffY));
                container.style.height = newHeight + "px";
                container.style.top = (startTop + startHeight - newHeight) + "px";
            }

            // 底部调整
            if (direction === "b" || direction === "lb" || direction === "rb") {
                var newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + diffY));
                container.style.height = newHeight + "px";
            }
        });

        document.addEventListener("mouseup", function() {
            if (!isResizing) return;
            isResizing = false;
            handle.classList.remove("active");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        });
    });

    // 按住顶部拖动窗口
    document.querySelectorAll(".preview-header, .editor-header").forEach(function(header) {
        var container = header.closest(".preview-container, .editor-container");
        if (!container) return;

        var isDragging = false;
        var startX, startY, startLeft, startTop;

        header.addEventListener("mousedown", function(e) {
            // 排除按钮点击
            if (e.target.closest("button")) return;

            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            var rect = container.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // 切换为绝对定位以支持拖动
            container.style.position = "absolute";
            container.style.left = rect.left + "px";
            container.style.top = rect.top + "px";
            container.style.transform = "none";
            container.style.margin = "0";

            document.body.style.cursor = "move";
            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", function(e) {
            if (!isDragging) return;

            var diffX = e.clientX - startX;
            var diffY = e.clientY - startY;
            var newLeft = startLeft + diffX;
            var newTop = startTop + diffY;

            // 限制在窗口内
            newLeft = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, newTop));

            container.style.left = newLeft + "px";
            container.style.top = newTop + "px";
        });

        document.addEventListener("mouseup", function() {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        });
    });
}

// ===== 提示消息 =====
function showToast(message, type) {
    const toast = document.getElementById("toast");
    const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle" };
    toast.className = "toast-msg " + type;
    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + message;
    toast.classList.add("show");

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() {
        toast.classList.remove("show");
    }, 3000);
}

// ===== 事件监听 =====
function setupEventListeners() {
    // 导航按钮
    document.getElementById("back-btn").addEventListener("click", goBack);
    document.getElementById("forward-btn").addEventListener("click", goForward);
    document.getElementById("up-btn").addEventListener("click", goUp);

    // 下载按钮
    document.getElementById("download-btn").addEventListener("click", function() {
        downloadSelectedFiles();
    });

    // 下载按钮hover生成二维码
    (function() {
        var qrPopup = document.getElementById('qr-popup');
        var qrPopupBody = document.getElementById('qr-popup-body');
        var qrInstance = null;
        var qrTimer = null;
        var currentQrUrl = '';

        function getDownloadUrl() {
            if (selectedFiles.length === 0) return '';
            if (selectedFiles.length === 1) {
                // 单文件/目录：使用下载页面
               return getLanUrl(window.location.origin) + '/api/d?path=' + encodeURIComponent(selectedFiles[0].path);
            }
            // 多文件：使用下载页面（逗号分隔paths）
            var pathsParam = selectedFiles.map(function(f){ return f.path; }).join(',');
           return getLanUrl(window.location.origin) + '/api/d?paths=' + encodeURIComponent(pathsParam);
        }

        function showQrPopup(btn) {
            var url = getDownloadUrl();
            if (!url) return;

            // 生成二维码
            if (url !== currentQrUrl) {
                qrPopupBody.innerHTML = '';
                qrInstance = new QRCode(qrPopupBody, {
                    text: url,
                    width: 160,
                    height: 160,
                    colorDark: '#181a2e',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
                currentQrUrl = url;
            }

            // 定位弹出框
            var rect = btn.getBoundingClientRect();
            var popupWidth = 210;
            var popupHeight = 280;
            var left = rect.left + rect.width / 2 - popupWidth / 2;
            var top = rect.bottom + 10;

            // 边界检测
            if (left < 10) left = 10;
            if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
            if (top + popupHeight > window.innerHeight - 10) {
                top = rect.top - popupHeight - 10;
                qrPopup.querySelector('.qr-popup-arrow').style.top = '';
                qrPopup.querySelector('.qr-popup-arrow').style.bottom = '-6px';
                qrPopup.querySelector('.qr-popup-arrow').style.transform = 'translateX(-50%) rotate(-135deg)';
            } else {
                qrPopup.querySelector('.qr-popup-arrow').style.top = '-6px';
                qrPopup.querySelector('.qr-popup-arrow').style.bottom = '';
                qrPopup.querySelector('.qr-popup-arrow').style.transform = 'translateX(-50%) rotate(45deg)';
            }

            qrPopup.style.left = left + 'px';
            qrPopup.style.top = top + 'px';
            qrPopup.classList.add('show');
        }

        function hideQrPopup() {
            qrPopup.classList.remove('show');
        }

        var downloadBtn = document.getElementById('download-btn');
        downloadBtn.addEventListener('mouseenter', function() {
            if (this.disabled) return;
            // 手机端不生成二维码
            if (window.innerWidth <= 768) return;
            clearTimeout(qrTimer);
            qrTimer = setTimeout(function() { showQrPopup(downloadBtn); }, 300);
        });
        downloadBtn.addEventListener('mouseleave', function() {
            clearTimeout(qrTimer);
            hideQrPopup();
        });
        // 点击时隐藏二维码
        downloadBtn.addEventListener('click', function() {
            hideQrPopup();
        });
    })();

    // 上传文件菜单
    var uploadFileMenu = document.getElementById("upload-file-menu");
    if (uploadFileMenu) uploadFileMenu.addEventListener("click", function(e) {
        e.preventDefault();
        // 清除旧的上传信息
        document.getElementById("file-input").value = "";
        document.getElementById("upload-dropzone").classList.remove("has-files");
        document.getElementById("upload-file-list").style.display = "none";
        document.getElementById("upload-dropzone-placeholder").style.display = "";
        document.getElementById("upload-progress").style.display = "none";
        document.querySelector("#upload-progress .progress-bar-fill").style.width = "0%";
        document.querySelector("#upload-progress .progress-text").textContent = "0%";
        openModal("upload-modal");
    });

    // 上传文件夹菜单
    var uploadFolderMenu = document.getElementById("upload-folder-menu");
    if (uploadFolderMenu) uploadFolderMenu.addEventListener("click", function(e) {
        e.preventDefault();
        // 清除旧的上传信息
        document.getElementById("folder-input").value = "";
        document.getElementById("folder-dropzone").classList.remove("has-files");
        document.getElementById("folder-file-list").style.display = "none";
        document.getElementById("folder-dropzone-placeholder").style.display = "";
        document.getElementById("folder-upload-progress").style.display = "none";
        document.querySelector("#folder-upload-progress .progress-bar-fill").style.width = "0%";
        document.querySelector("#folder-upload-progress .progress-text").textContent = "0%";
        openModal("upload-folder-modal");
    });

    document.getElementById("file-input").addEventListener("change", function() {
        displayUploadFileList(this.files);
    });

    document.getElementById("folder-input").addEventListener("change", function() {
        displayFolderFileList(this.files);
    });

    // 新建文件夹菜单
    var createFolderMenu = document.getElementById("create-folder-menu");
    if (createFolderMenu) createFolderMenu.addEventListener("click", function(e) {
        e.preventDefault();
        openModal("folder-modal");
        document.getElementById("folder-name-input").value = "";
        setTimeout(() => document.getElementById("folder-name-input").focus(), 100);
    });

    // 新建文件菜单
    var createFileMenu = document.getElementById("create-file-menu");
    if (createFileMenu) createFileMenu.addEventListener("click", function(e) {
        e.preventDefault();
        openModal("create-file-modal");
        document.getElementById("create-file-name-input").value = "";
        setTimeout(() => document.getElementById("create-file-name-input").focus(), 100);
    });

    // 上传确认
    document.getElementById("upload-confirm-btn").addEventListener("click", uploadFiles);
    document.getElementById("upload-folder-confirm-btn").addEventListener("click", uploadFolder);

    // 新建文件夹确认
    document.getElementById("create-folder-confirm-btn").addEventListener("click", createFolder);

    // 新建文件确认
    document.getElementById("create-file-confirm-btn").addEventListener("click", createFile);

    // 重命名确认
    document.getElementById("rename-confirm-btn").addEventListener("click", renameFile);

    // 移动/复制确认
    document.getElementById("move-copy-confirm-btn").addEventListener("click", moveOrCopyFile);

    // 拖拽上传
    setupDropzone("upload-dropzone", "file-input");
    setupDropzone("folder-dropzone", "folder-input");

    // 清除选择
    document.getElementById("upload-clear-btn").addEventListener("click", function(e) {
        e.stopPropagation();
        document.getElementById("file-input").value = "";
        document.getElementById("upload-dropzone").classList.remove("has-files");
        document.getElementById("upload-file-list").style.display = "none";
        document.getElementById("upload-dropzone-placeholder").style.display = "";
    });

    document.getElementById("folder-clear-btn").addEventListener("click", function(e) {
        e.stopPropagation();
        document.getElementById("folder-input").value = "";
        document.getElementById("folder-dropzone").classList.remove("has-files");
        document.getElementById("folder-file-list").style.display = "none";
        document.getElementById("folder-dropzone-placeholder").style.display = "";
    });

    // 关闭模态框
    document.querySelectorAll(".modal-close-btn, .modal-cancel").forEach(btn => {
        btn.addEventListener("click", function() {
            const modal = this.closest(".modal-overlay");
            if (modal) closeModal(modal.id);
        });
    });

    // 点击模态框外部关闭
    window.addEventListener("click", function(event) {
        // 检查点击是否在模态框内部（.modal-dialog, .preview-container, .editor-container）
        // 如果在内部，则不关闭
        if (event.target.closest(".modal-dialog, .preview-container, .editor-container")) {
            return;
        }
        if (event.target.classList.contains("modal-overlay")) {
            // 未保存确认对话框不允许点击外部关闭
            if (event.target.id === "unsaved-confirm-modal") {
                return;
            }
            if (event.target.id === "preview-modal") {
                closePreview();
            } else {
                closeModal(event.target.id);
            }
        }
    });

    // 预览关闭
    document.getElementById("preview-close-btn").addEventListener("click", closePreview);

    // 预览全屏切换
    document.getElementById("preview-fullscreen-btn").addEventListener("click", function() {
        var container = document.querySelector(".preview-container");
        if (!container) return;
        var btn = document.getElementById("preview-fullscreen-btn");
        var icon = btn.querySelector("i");
        var label = btn.querySelector("span");
        if (container.classList.contains("preview-fullscreen")) {
            // 退出全屏
            container.classList.remove("preview-fullscreen");
            icon.className = "fas fa-expand";
            label.textContent = "全屏";
        } else {
            // 进入全屏
            container.classList.add("preview-fullscreen");
            icon.className = "fas fa-compress";
            label.textContent = "退出";
        }
    });

    // 编辑器
    document.getElementById("editor-save-btn").addEventListener("click", saveFile);

    // 未保存确认对话框
    document.getElementById("unsaved-save-btn").addEventListener("click", closeEditorSave);
    document.getElementById("unsaved-discard-btn").addEventListener("click", closeEditorDiscard);
    document.getElementById("unsaved-cancel-btn").addEventListener("click", closeEditorCancel);

    const editorTextarea = document.getElementById("editor-textarea");
    const editorHighlight = document.getElementById("editor-highlight");

    // 滚动同步
    editorTextarea.addEventListener("scroll", function() {
        if (editorHighlight) {
            editorHighlight.scrollTop = this.scrollTop;
            editorHighlight.scrollLeft = this.scrollLeft;
        }
    });

    editorTextarea.addEventListener("input", function() {
        this.dataset.modified = "true";
        updateEditorStatus();
        updateEditorHighlight();
    });
    editorTextarea.addEventListener("click", function() {
        updateEditorStatus();
    });
    editorTextarea.addEventListener("keyup", function() {
        updateEditorStatus();
    });

    editorTextarea.addEventListener("keydown", function(e) {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
            this.dataset.modified = "true";
            updateEditorStatus();
            updateEditorHighlight();
        }
        if (e.ctrlKey && e.key === "s") {
            e.preventDefault();
            saveFile();
        }
    });

    // ESC 键和左右箭头
    document.addEventListener("keydown", function(e) {
        const previewModal = document.getElementById("preview-modal");
        const isPreviewActive = previewModal.classList.contains("active");

        if (e.key === "Escape") {
            if (isPreviewActive) {
                closePreview();
            } else if (selectedFiles.length > 0) {
                clearSelection();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
            // Ctrl+A 全选
            e.preventDefault();
            const container = document.getElementById("file-container");
            const items = container.querySelectorAll(".file-item");
            if (items.length > 0) {
                selectedFiles = [];
                items.forEach(function(item, idx) {
                    item.classList.add("selected");
                    selectedFiles.push({
                        path: item.dataset.path,
                        name: item.dataset.name,
                        isDir: item.dataset.isDir === "true"
                    });
                });
                lastSelectedIndex = items.length - 1;
                updateSelectionInfo();
            }
        } else if (e.key === "Delete" && selectedFiles.length > 0 && !isPreviewActive) {
            // Delete 键删除
            if (selectedFiles.length > 1) {
                batchDeleteFiles(selectedFiles.map(f => f.path));
            } else if (selectedFile) {
                deleteFile(selectedFile.path);
            }
        } else if (isPreviewActive) {
            // 左右箭头切换图片
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                navigatePrevImage();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                navigateNextImage();
            }
        }
    });

    // 右键菜单
    document.addEventListener("click", function(e) {
        if (!e.target.closest(".context-menu-item") && !e.target.closest(".context-menu")) {
            hideContextMenu();
        }
    });

    document.getElementById("context-menu").addEventListener("click", function(e) {
        const menuItem = e.target.closest(".context-menu-item");
        if (menuItem) {
            e.stopPropagation();
            handleContextMenuAction(menuItem.getAttribute("data-action"));
        }
    });

    // 侧边栏
    const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener("click", function() {
            document.querySelector(".sidebar").classList.add("collapsed");
        });
    }

    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener("click", function() {
            const sidebar = document.querySelector(".sidebar");
            const overlay = document.getElementById("sidebar-overlay");
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                sidebar.classList.toggle("mobile-open");
                overlay.classList.toggle("active");
            } else {
                sidebar.classList.toggle("collapsed");
            }
        });
    }

    // 侧边栏遮罩点击关闭
    document.getElementById("sidebar-overlay").addEventListener("click", function() {
        document.querySelector(".sidebar").classList.remove("mobile-open");
        this.classList.remove("active");
    });

    // 刷新
    document.getElementById("refresh-btn").addEventListener("click", function() {
        loadFiles(currentPath);
        loadTree();
        calculateStorage();
    });

    // 搜索功能
    const searchInput = document.getElementById("search-input");
    let searchTimeout = null;

    searchInput.addEventListener("input", function() {
        const query = this.value.trim();
        const clearBtn = document.getElementById("search-clear-btn");

        // 显示/隐藏清除按钮
        if (query) {
            clearBtn.classList.add("visible");
        } else {
            clearBtn.classList.remove("visible");
        }

        // 防抖搜索
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query) {
                searchFiles(query, currentPath, true);
            } else {
                clearSearch();
            }
        }, 500);
    });

    // 按Enter键立即搜索
    searchInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            if (query) {
                searchFiles(query, currentPath, true);
            } else {
                clearSearch();
            }
        }
    });

    // 清除搜索按钮
    document.getElementById("search-clear-btn").addEventListener("click", function() {
        clearSearch();
        searchInput.blur();
    });

    // 点击搜索框外部时取消焦点
    document.addEventListener("click", function(e) {
        if (!searchInput.closest('.file-toolbar-search').contains(e.target)) {
            searchInput.blur();
        }
    });

    // 排序 - Bootstrap dropdown handles show/hide
    document.querySelectorAll(".sort-menu-item").forEach(item => {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            sortField = this.getAttribute("data-field");
            sortOrder = this.getAttribute("data-order");
            document.querySelectorAll(".sort-menu-item").forEach(i => i.classList.remove("active"));
            this.classList.add("active");
            loadFiles(currentPath);
        });
    });

    // 视图切换
    document.getElementById("grid-view-btn").addEventListener("click", function() {
        document.getElementById("file-container").classList.remove("list-view");
        document.getElementById("file-container").classList.add("grid-view");
        this.classList.add("active");
        document.getElementById("list-view-btn").classList.remove("active");
        loadFiles(currentPath);
    });

    document.getElementById("list-view-btn").addEventListener("click", function() {
        document.getElementById("file-container").classList.remove("grid-view");
        document.getElementById("file-container").classList.add("list-view");
        this.classList.add("active");
        document.getElementById("grid-view-btn").classList.remove("active");
        loadFiles(currentPath);
    });

    // 点击内容区取消选择
    document.getElementById("content-area").addEventListener("click", function(e) {
        // 如果正在拖选或刚刚完成拖选，不取消选择
        if (e.target.closest(".drag-selection-box") || isDragging) {
            return;
        }
        if (e.target === this || e.target === document.getElementById("file-container")) {
            clearSelection();
        }
    });

    // Enter 键确认
    document.getElementById("folder-name-input").addEventListener("keydown", function(e) {
        if (e.key === "Enter") createFolder();
    });
    document.getElementById("rename-input").addEventListener("keydown", function(e) {
        if (e.key === "Enter") renameFile();
    });
}

// ===== 自动锁定 =====
let autoLockTimer = null;

function resetAutoLockTimer() {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    const minutes = parseInt(localStorage.getItem('autoLock') || '0');
    if (minutes > 0 && currentUser) {
        autoLockTimer = setTimeout(function() {
            if (currentUser) {
                handleLogout();
                showToast('已自动锁定，请重新登录', 'info');
            }
        }, minutes * 60 * 1000);
    }
}

// 用户交互时重置自动锁定计时器
['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function(evt) {
    document.addEventListener(evt, resetAutoLockTimer, { passive: true });
});

// ===== 应用默认设置 =====
function applyDefaultSettings() {
    // 应用默认排序
    const defaultSort = localStorage.getItem('defaultSort');
    if (defaultSort) {
        sortField = defaultSort;
    }

    // 应用默认视图
    const defaultView = localStorage.getItem('defaultView') || 'grid';
    const container = document.getElementById('file-container');
    if (container) {
        container.classList.remove('grid-view', 'list-view');
        container.classList.add(defaultView + '-view');
    }
    // 更新视图切换按钮
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', defaultView === 'grid');
        listBtn.classList.toggle('active', defaultView === 'list');
    }

    // 应用播放列表位置
    const playlistPosition = localStorage.getItem('playlistPosition') || 'left';
    applyPlaylistPosition(playlistPosition);
}


// 获取服务器信息（IP地址等）
async function fetchServerInfo() {
    try {
        const response = await fetch('/api/server-info');
        if (response.ok) {
            const data = await response.json();
            serverInfoCache = data.data;
            console.log('Server info loaded:', serverInfoCache);
        }
    } catch (error) {
        console.error('Failed to fetch server info:', error);
    }
}

// ===== 获取局域网可访问的URL（使用服务端IP信息） =====
function getLanUrl(urlStr) {
    if (!serverInfoCache || !serverInfoCache.preferredIP) return urlStr;
    try {
        var url = new URL(urlStr);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            url.hostname = serverInfoCache.preferredIP;
        }
        return url.toString();
    } catch(e) {
        if (serverInfoCache && serverInfoCache.preferredIP) {
            urlStr = urlStr.replace("//localhost", "//" + serverInfoCache.preferredIP);
            urlStr = urlStr.replace("//127.0.0.1", "//" + serverInfoCache.preferredIP);
        }
        return urlStr;
    }
}

// ===== 顶部二维码 =====
function initTopbarQrCode() {
    const wrapper = document.querySelector('.topbar-qrcode-wrapper');
    const qrBody = document.getElementById('topbar-qrcode-body');
    if (!wrapper || !qrBody) return;

    let qrInstance = null;
    let currentUrl = '';

    function getQrUrl() {
        // 获取当前页面的完整URL
        let url = window.location.href;
        
        // 移除已存在的token参数（如果有），以避免重复
        url = url.replace(/[?&]token=[^&]*/, '');
        
        // 移除URL末尾的?或&（如果有）
        url = url.replace(/[?&]$/, '');
        url = getLanUrl(url);
        
        // 如果已登录，附带token参数
        if (authToken) {
            // 判断URL是否已有参数
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'token=' + encodeURIComponent(authToken);
        }
        return url;
    }

    function generateQr() {
        const url = getQrUrl();
        if (url === currentUrl) return;
        currentUrl = url;
        qrBody.innerHTML = '';
        qrInstance = new QRCode(qrBody, {
            text: url,
            width: 150,
            height: 150,
            colorDark: '#181a2e',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    wrapper.addEventListener('mouseenter', function() {
        generateQr();
    });
}

// ===== 初始化 =====
document.addEventListener("DOMContentLoaded", async function() {
    // 初始化主题
    initTheme();
    // 应用默认设置
    applyDefaultSettings();
    // 初始化用户菜单（优先绑定登录按钮，避免后续错误导致登录不可用）
    initUserMenu();
    // 初始化音频播放器
    initAudioPlayer();
    // 检查登录状态
    await checkLoginStatus();
    // 加载文件
    loadFiles(currentPath);
    setupEventListeners();
    setupDragSelection();
    loadTree();
    setupRootTreeToggle();
    calculateStorage();
    initResizeHandles();
    // 获取服务器信息（用于二维码生成局域网IP）
    await fetchServerInfo();
    // 初始化顶部二维码
    initTopbarQrCode();
    // 启动自动锁定计时器
    resetAutoLockTimer();
});

// ===== 用户认证 =====
async function checkLoginStatus() {
    // 检查URL中是否携带token参数（扫码访问）
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
        // 清除URL中的token参数，避免泄露
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        // 验证token有效性
        try {
            authToken = urlToken;
            const response = await apiCall('/api/verify-token', {
                method: 'GET'
            });
            if (response.success) {
                currentUser = response.data;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUserInfo();
                document.querySelector('.app').classList.add('app-ready');
                hideLoginModal();
                showToast(`欢迎回来，${currentUser.displayName}！`, 'success');
                return;
            }
        } catch (error) {
            console.error('URL token verification error:', error);
        }
        authToken = '';
    }

    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        try {
            // 验证token有效性
            const response = await apiCall('/api/verify-token', {
                method: 'GET'
            });

            if (response.success) {
                authToken = savedToken;
                currentUser = JSON.parse(savedUser);
                updateUserInfo();
                // 已登录，显示主界面，隐藏登录页
                document.querySelector('.app').classList.add('app-ready');
                hideLoginModal();
            } else {
                // token无效，清除登录状态并显示登录页面
                currentUser = null;
                authToken = '';
                localStorage.removeItem('currentUser');
                localStorage.removeItem('authToken');
                updateUserInfo();
                showLoginModal();
            }
        } catch (error) {
            console.error('Token verification error:', error);
            // 验证失败，显示登录页面
            currentUser = null;
            authToken = '';
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            updateUserInfo();
            showLoginModal();
        }
    } else {
        // 没有保存的登录信息，更新UI权限状态并显示登录页面
        currentUser = null;
        authToken = '';
        updateUserInfo();
        showLoginModal();
    }
}

function showLoginModal() {
    const page = document.getElementById('login-page');
    page.classList.remove('hidden');
    // 显示登录页时隐藏主界面
    document.querySelector('.app').classList.remove('app-ready');
    setTimeout(() => {
        document.getElementById('login-username').focus();
    }, 100);
}

function hideLoginModal() {
    const page = document.getElementById('login-page');
    page.classList.add('hidden');
    // 隐藏登录页的同时显示主界面
    document.querySelector('.app').classList.add('app-ready');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }

    try {
        const response = await apiCall('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (response.success) {
            // 保存token和用户信息
            authToken = response.data.token;
            currentUser = response.data.user;

            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            updateUserInfo();
            hideLoginModal();
            showToast(`欢迎回来，${currentUser.displayName}！`, 'success');
        } else {
            showToast(response.message || '登录失败', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('登录失败，请稍后重试', 'error');
    }
}

async function handleLogout() {
    try {
        // 调用后端登出API
        await apiCall('/api/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    // 清除本地状态
    currentUser = null;
    authToken = '';
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateUserInfo();
    showToast('已退出登录', 'info');
    showLoginModal();
}

function updateUserInfo() {
    const userNameElement = document.getElementById('current-user-name');
    const userInfoNameElement = document.getElementById('user-info-name');
    const loginHint = document.getElementById('user-login-hint');
    const userInfoIcon = document.getElementById('user-info-icon');
    if (currentUser) {
        userNameElement.textContent = currentUser.displayName;
        if (userInfoNameElement) userInfoNameElement.textContent = currentUser.displayName;
        loginHint.classList.add('hidden');
        if (currentUser.type === 'admin') {
            userInfoIcon.className = 'fas fa-user-shield';
        } else {
            userInfoIcon.className = 'fas fa-user-check';
        }
    } else {
        userNameElement.textContent = '未登录';
        if (userInfoNameElement) userInfoNameElement.textContent = '未登录';
        loginHint.classList.remove('hidden');
        userInfoIcon.className = 'fas fa-user';
    }
    // 根据权限更新按钮可见性
    updateAuthUI();
}

// 根据权限更新UI元素的可见性
function updateAuthUI() {
    const isLoggedIn = currentUser !== null;
    const isAdmin = currentUser && (currentUser.type === 'root' || currentUser.type === 'admin');
    const isRoot = currentUser && currentUser.type === 'root';

    // 更新带data-auth属性的元素
    document.querySelectorAll('[data-auth]').forEach(el => {
        const authLevel = el.getAttribute('data-auth');
        let hasPermission = false;
        if (authLevel === 'user' && isLoggedIn) hasPermission = true;
        if (authLevel === 'admin' && isAdmin) hasPermission = true;
        if (authLevel === 'root' && isRoot) hasPermission = true;

        if (hasPermission) {
            el.classList.remove('auth-disabled', 'auth-hidden');
            el.removeAttribute('data-auth-denied');
            // 恢复隐藏的菜单项
            const li = el.closest('li');
            if (li) li.classList.remove('auth-hidden');
        } else {
            // 下拉菜单项：隐藏整个 li
            const isMenuItem = el.classList.contains('dropdown-item') || el.classList.contains('user-menu-item');
            // 设置区块：隐藏整个 section
            const isSettingsSection = el.classList.contains('settings-section');
            if (isMenuItem) {
                const li = el.closest('li');
                if (li) li.classList.add('auth-hidden');
            } else if (isSettingsSection) {
                el.classList.add('auth-hidden');
            } else {
                el.classList.add('auth-disabled');
            }
            el.setAttribute('data-auth-denied', authLevel);
        }
    });
}

// 权限不足提示
document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-auth-denied]');
    if (target) {
        e.preventDefault();
        e.stopPropagation();
        var authLevel = target.getAttribute('data-auth-denied');
        if (authLevel === 'user') {
            showToast('请先登录后再使用此功能', 'error');
        } else if (authLevel === 'admin') {
            showToast('只有管理员可以使用此功能', 'error');
        }
    }
}, true);

// ===== 主题切换 =====
function initTheme() {
    applyTheme(currentTheme);
    updateThemeButtons();
    // 初始化topbar主题按钮图标
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    if (topbarThemeBtn) {
        topbarThemeBtn.querySelector('i').className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    currentTheme = theme;
    localStorage.setItem('theme', theme);
}

function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-theme') === currentTheme) {
            btn.classList.add('active');
        }
    });
}

function handleThemeChange(theme) {
    applyTheme(theme);
    updateThemeButtons();
    // 同步topbar主题按钮图标
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    if (topbarThemeBtn) {
        topbarThemeBtn.querySelector('i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    showToast(`已切换到${theme === 'dark' ? '深色' : '浅色'}模式`, 'info');
}

// ===== 用户菜单 =====
function initUserMenu() {
    // 登录按钮
    document.getElementById('login-confirm-btn').addEventListener('click', handleLogin);

    // 用户信息点击事件 - 未登录时跳转到登录页面，已登录时跳转到个人信息页面
    document.getElementById('user-info').addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentUser) {
            showLoginModal();
        } else {
            showProfileModal();
        }
    });

    // 退出登录
    document.getElementById('logout-menu').addEventListener('click', function(e) {
        e.preventDefault();
        handleLogout();
    });

    // 设置菜单
    document.getElementById('settings-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showSettingsModal();
    });

    // 关于菜单
    document.getElementById('about-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showAboutModal();
    });

    // 安全管理菜单
    document.getElementById('security-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showSecurityModal();
    });

    // 主题切换按钮
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            handleThemeChange(theme);
        });
    });

    // 顶部导航栏主题切换按钮
    document.getElementById('topbar-theme-btn').addEventListener('click', function() {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        handleThemeChange(newTheme);
        // 更新按钮图标
        this.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });

    // 设置页面返回按钮
    document.getElementById('settings-back-btn').addEventListener('click', hideSettingsModal);
    
// 用户信息页面返回按钮
    document.getElementById('profile-back-btn').addEventListener('click', hideProfileModal);

    // 显示名称即时保存
    document.getElementById('profile-displayname').addEventListener('input', onProfileDisplayNameChange);

    // 修改密码按钮
    document.getElementById('profile-change-password-btn').addEventListener('click', changeProfilePassword);

    // 关于页面返回按钮
    document.getElementById('about-back-btn').addEventListener('click', hideAboutModal);

    // 安全管理页面返回按钮
    document.getElementById('security-back-btn').addEventListener('click', hideSecurityModal);

    // 安全管理 - 保存配置
    document.getElementById('security-save-config').addEventListener('click', saveSecurityConfig);

    // 安全管理 - 添加用户
    document.getElementById('security-add-user-btn').addEventListener('click', function() {
        openUserEditModal(null, '', 'user');
    });

    // 用户编辑弹窗 - 关闭/取消
    document.getElementById('user-edit-modal-close').addEventListener('click', closeUserEditModal);
    document.getElementById('user-edit-cancel-btn').addEventListener('click', closeUserEditModal);

    // 用户编辑弹窗 - 保存
    document.getElementById('user-edit-save-btn').addEventListener('click', saveUser);

    // 设置页面 - 视图切换
    document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.settings-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            var view = this.getAttribute('data-view');
            localStorage.setItem('defaultView', view);
            // 立即应用视图
            var container = document.getElementById('file-container');
            container.classList.remove('grid-view', 'list-view');
            container.classList.add(view + '-view');
            var gridBtn = document.getElementById('grid-view-btn');
            var listBtn = document.getElementById('list-view-btn');
            if (gridBtn) gridBtn.classList.toggle('active', view === 'grid');
            if (listBtn) listBtn.classList.toggle('active', view === 'list');
        });
    });

    // 设置页面 - 自定义下拉菜单初始化
    initSettingsDropdowns();

    // 设置页面 - 显示隐藏文件
    document.getElementById('settings-show-hidden').addEventListener('change', function() {
        localStorage.setItem('showHidden', this.checked);
        // 立即刷新文件列表
        renderFiles(sortFiles(currentAllFiles));
    });

    // 设置页面 - 清除缓存
    document.getElementById('settings-clear-cache').addEventListener('click', function() {
        localStorage.removeItem('defaultSort');
        localStorage.removeItem('showHidden');
        localStorage.removeItem('uploadConflict');
        localStorage.removeItem('autoLock');
        localStorage.removeItem('defaultView');
        loadSettings();
        applyDefaultSettings();
        resetAutoLockTimer();
        // 重新加载文件列表
        renderFiles(sortFiles(currentAllFiles));
        showToast('缓存已清除', 'success');
    });

    // 登录表单回车提交
    document.getElementById('login-username').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
}

// ===== 用户信息页面 =====
function showProfileModal() {
    const page = document.getElementById('profile-page');
    page.classList.add('show');
    loadProfileInfo();
}

function hideProfileModal() {
    const page = document.getElementById('profile-page');
    page.classList.remove('show');
}

function loadProfileInfo() {
    if (!currentUser) return;
    const avatar = document.getElementById('profile-avatar');
    const displayname = document.getElementById('profile-username');
    const typeBadge = document.getElementById('profile-type-badge');
    const account = document.getElementById('profile-account');
    const displaynameInput = document.getElementById('profile-displayname');

    // 头像样式
    avatar.className = 'profile-avatar ' + currentUser.type;
    if (currentUser.type === 'root') {
        avatar.innerHTML = '<i class="fas fa-crown"></i>';
    } else if (currentUser.type === 'admin') {
        avatar.innerHTML = '<i class="fas fa-user-shield"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-user-circle"></i>';
    }

    // 显示名称
    displayname.textContent = currentUser.displayName || currentUser.username;

    // 类型标签
    const typeLabels = { root: 'Root', admin: '管理员', user: '普通用户' };
    typeBadge.className = 'profile-type-badge ' + currentUser.type;
    typeBadge.textContent = typeLabels[currentUser.type] || currentUser.type;

    // 账号
    account.textContent = '@' + currentUser.username;

    // 显示名称输入框
    displaynameInput.value = currentUser.displayName || '';

    // 清空密码输入
    document.getElementById('profile-old-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
}

// 显示名称即时保存（防抖）
let profileDisplayNameTimer = null;
function onProfileDisplayNameChange() {
    clearTimeout(profileDisplayNameTimer);
    profileDisplayNameTimer = setTimeout(async () => {
        const displayName = document.getElementById('profile-displayname').value.trim();
        if (!displayName || displayName === (currentUser.displayName || '')) return;

        try {
            const response = await apiCall('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: displayName })
            });
            if (response && response.success) {
                currentUser.displayName = displayName;
                updateUserInfo();
                loadProfileInfo();
                showToast('显示名称已更新', 'success');
            } else {
                showToast(response.message || '更新失败', 'error');
            }
        } catch (error) {
            console.error('Update display name error:', error);
            showToast('更新失败', 'error');
        }
    }, 600);
}

// 修改密码
async function changeProfilePassword() {
    const oldPassword = document.getElementById('profile-old-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    if (!oldPassword) {
        showToast('请输入当前密码', 'error');
        return;
    }
    if (!newPassword) {
        showToast('请输入新密码', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast('两次输入的新密码不一致', 'error');
        return;
    }
    if (newPassword.length < 4) {
        showToast('新密码长度不能少于4位', 'error');
        return;
    }

    try {
        const response = await apiCall('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oldPassword: oldPassword,
                password: newPassword
            })
        });
        if (response && response.success) {
            document.getElementById('profile-old-password').value = '';
            document.getElementById('profile-new-password').value = '';
            document.getElementById('profile-confirm-password').value = '';
            showToast('密码已修改', 'success');
        } else {
            showToast(response.message || '修改失败', 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('修改失败', 'error');
    }
}

function showSettingsModal() {
    const page = document.getElementById('settings-page');
    page.classList.add('show');
    // 更新权限可见性
    updateAuthUI();
    // 恢复设置值
    loadSettings();
}

function hideSettingsModal() {
    const page = document.getElementById('settings-page');
    page.classList.remove('show');
}

function showAboutModal() {
    const page = document.getElementById('about-page');
    page.classList.add('show');
}

function hideAboutModal() {
    const page = document.getElementById('about-page');
    page.classList.remove('show');
}

// ===== 安全管理 =====
let securityConfig = null;
let editingUsername = null; // null 表示新增，有值表示编辑

function showSecurityModal() {
    const page = document.getElementById('security-page');
    page.classList.add('show');
    loadSecurityConfig();
}

function hideSecurityModal() {
    const page = document.getElementById('security-page');
    page.classList.remove('show');
}

async function loadSecurityConfig() {
    try {
        const response = await apiCall('/api/admin/config', { method: 'GET' });
            if (!response) {
        showToast('保存配置失败：无响应', 'error');
        return;
    }
        if (response.success) {
            securityConfig = response.data;
            document.getElementById('security-max-storage').value = securityConfig.maxStorage;
            document.getElementById('security-preview-max-size').value = securityConfig.previewMaxSize;
            renderUserList(securityConfig.users);
        } else {
            showToast(response.message || '加载安全配置失败', 'error');
        }
    } catch (error) {
        console.error('Load security config error:', error);
        showToast('加载安全配置失败', 'error');
    }
}

function renderUserList(users) {
    const container = document.getElementById('security-user-list');
    container.innerHTML = '';
    users.forEach(user => {
        const isRoot = user.type === 'root';
        const isAdmin = user.type === 'admin';
        const typeLabel = isRoot ? 'Root' : (isAdmin ? '管理员' : '普通用户');
        const iconClass = isRoot ? 'fa-crown' : (isAdmin ? 'fa-user-shield' : 'fa-user');
        const iconColor = isRoot ? 'root' : (isAdmin ? 'admin' : 'user');
        const item = document.createElement('div');
        item.className = 'security-user-item';
        item.innerHTML = `
            <div class="security-user-icon ${iconColor}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="security-user-info">
                <div class="security-user-name">${user.displayName || user.username}</div>
                <div class="security-user-detail">${user.username} · ${typeLabel}</div>
            </div>
            <div class="security-user-actions">
                <button class="security-user-btn" title="编辑" data-username="${user.username}" data-displayname="${user.displayName || ''}" data-type="${user.type}">
                    <i class="fas fa-pen"></i>
                </button>
                ${!isRoot ? `<button class="security-user-btn danger" title="删除" data-delete-username="${user.username}">
                    <i class="fas fa-trash"></i>
                </button>` : ''}
            </div>
        `;
        container.appendChild(item);
    });

    // 绑定编辑按钮事件
    container.querySelectorAll('[data-username]').forEach(btn => {
        btn.addEventListener('click', function() {
            openUserEditModal(
                this.dataset.username,
                this.dataset.displayname,
                this.dataset.type
            );
        });
    });

    // 绑定删除按钮事件
    container.querySelectorAll('[data-delete-username]').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteUser(this.dataset.deleteUsername);
        });
    });
}

async function saveSecurityConfig() {
    const maxStorage = document.getElementById('security-max-storage').value.trim();
    const previewMaxSize = document.getElementById('security-preview-max-size').value.trim();

    if (!maxStorage || !previewMaxSize) {
        showToast('请填写完整的配置信息', 'error');
        return;
    }

    try {
        const response = await apiCall('/api/admin/update-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxStorage, previewMaxSize })
        });
    if (!response) {
        showToast('保存配置失败：无响应', 'error');
        return;
    }

        if (response.success) {
            showToast('配置已保存', 'success');
            loadSecurityConfig();
            calculateStorage();
        } else {
            showToast(response.message || '保存配置失败', 'error');
        }
    } catch (error) {
        console.error('Save security config error:', error);
        showToast('保存配置失败', 'error');
    }
}

function openUserEditModal(username, displayName, userType) {
    editingUsername = username || null;
    const modal = document.getElementById('user-edit-modal');
    const title = document.getElementById('user-edit-modal-title');
    const usernameInput = document.getElementById('user-edit-username');
    const passwordInput = document.getElementById('user-edit-password');
    const displaynameInput = document.getElementById('user-edit-displayname');
    const typeWrapper = document.getElementById('user-edit-type-wrapper');

    if (editingUsername) {
        title.textContent = '编辑用户';
        usernameInput.value = username;
        usernameInput.disabled = true;
        passwordInput.value = '';
        passwordInput.placeholder = '留空则不修改密码';
        displaynameInput.value = displayName;
        // root 用户类型不可修改，禁用类型下拉
        if (userType === 'root') {
            setUserEditType('root');
            typeWrapper.classList.add('disabled');
        } else {
            setUserEditType(userType || 'user');
            typeWrapper.classList.remove('disabled');
        }
    } else {
        title.textContent = '添加用户';
        usernameInput.value = '';
        usernameInput.disabled = false;
        passwordInput.value = '';
        passwordInput.placeholder = '输入密码';
        displaynameInput.value = '';
        setUserEditType('user');
        typeWrapper.classList.remove('disabled');
    }

    modal.classList.add('active');
}

function setUserEditType(type) {
    const wrapper = document.getElementById('user-edit-type-wrapper');
    const trigger = wrapper.querySelector('.settings-dropdown-trigger');
    const items = wrapper.querySelectorAll('.settings-dropdown-item');
    trigger.setAttribute('data-value', type);
    items.forEach(item => {
        item.classList.toggle('active', item.dataset.value === type);
        if (item.dataset.value === type) {
            trigger.querySelector('.settings-dropdown-text').textContent = item.querySelector('span').textContent;
        }
    });
}

function closeUserEditModal() {
    const modal = document.getElementById('user-edit-modal');
    modal.classList.remove('active');
    editingUsername = null;
}

async function saveUser() {
    const username = document.getElementById('user-edit-username').value.trim();
    const password = document.getElementById('user-edit-password').value;
    const typeWrapper = document.getElementById('user-edit-type-wrapper');
    const type = typeWrapper.querySelector('.settings-dropdown-trigger').dataset.value;
    const displayName = document.getElementById('user-edit-displayname').value.trim();

    if (!editingUsername && (!username || !password)) {
        showToast('请填写用户名和密码', 'error');
        return;
    }

    try {
        let response;
        if (editingUsername) {
            // root 用户不发送 type 字段，避免触发后端 root 类型保护
            const updateData = {
                username: editingUsername,
                password: password || '',
                displayName: displayName
            };
            if (type !== 'root') {
                updateData.type = type;
            }
            response = await apiCall('/api/admin/update-user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
                if (!response) {
        showToast('保存配置失败：无响应', 'error');
        return;
    }
        } else {
            response = await apiCall('/api/admin/add-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    type: type,
                    displayName: displayName || username
                })
            });
        }

        if (response.success) {
            showToast(editingUsername ? '用户已更新' : '用户已添加', 'success');
            closeUserEditModal();
            loadSecurityConfig();
        } else {
            showToast(response.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('Save user error:', error);
        showToast('操作失败', 'error');
    }
}

async function deleteUser(username) {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销。`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/delete-user?username=${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });

        if (response.success) {
            showToast('用户已删除', 'success');
            loadSecurityConfig();
        } else {
            showToast(response.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('删除失败', 'error');
    }
}

// 设置页面自定义下拉菜单
const settingsDropdowns = {};

function initSettingsDropdowns() {
    const dropdownConfigs = [
        { id: 'settings-default-sort', onChange: function(value) { localStorage.setItem('defaultSort', value); sortField = value; renderFiles(sortFiles(currentAllFiles)); } },
        { id: 'settings-upload-conflict', onChange: function(value) { localStorage.setItem('uploadConflict', value); } },
        { id: 'settings-auto-lock', onChange: function(value) { localStorage.setItem('autoLock', value); resetAutoLockTimer(); } },
        { id: 'settings-playlist-position', onChange: function(value) { localStorage.setItem('playlistPosition', value); applyPlaylistPosition(value); } },
        { id: 'user-edit-type', onChange: function(value) {} }
    ];

    dropdownConfigs.forEach(config => {
        const wrapper = document.getElementById(config.id + '-wrapper');
        if (!wrapper) return;

        const trigger = wrapper.querySelector('.settings-dropdown-trigger');
        const items = wrapper.querySelectorAll('.settings-dropdown-item');

        settingsDropdowns[config.id] = {
            wrapper: wrapper,
            trigger: trigger,
            items: items,
            _value: trigger.dataset.value,

            get value() {
                return this._value;
            },

            set value(val) {
                this._value = val;
                this.trigger.dataset.value = val;
                items.forEach(item => {
                    if (item.dataset.value === val) {
                        item.classList.add('active');
                        trigger.querySelector('.settings-dropdown-text').textContent = item.querySelector('span').textContent;
                    } else {
                        item.classList.remove('active');
                    }
                });
            }
        };

        // 点击触发器
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            // 关闭其他下拉菜单
            document.querySelectorAll('.settings-dropdown-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });

        // 点击选项
        items.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const value = item.dataset.value;
                settingsDropdowns[config.id].value = value;
                wrapper.classList.remove('open');
                if (config.onChange) config.onChange(value);
            });
        });
    });

    // 点击外部关闭
    document.addEventListener('click', function() {
        document.querySelectorAll('.settings-dropdown-wrapper.open').forEach(w => {
            w.classList.remove('open');
        });
    });
}

// 加载设置
function loadSettings() {
    const defaultSort = localStorage.getItem('defaultSort') || 'name';
    const showHidden = localStorage.getItem('showHidden') === 'true';
    const uploadConflict = localStorage.getItem('uploadConflict') || 'rename';
    const autoLock = localStorage.getItem('autoLock') || '0';
    const defaultView = localStorage.getItem('defaultView') || 'grid';
    const playlistPosition = localStorage.getItem('playlistPosition') || 'left';

    if (settingsDropdowns['settings-default-sort']) settingsDropdowns['settings-default-sort'].value = defaultSort;
    document.getElementById('settings-show-hidden').checked = showHidden;
    if (settingsDropdowns['settings-upload-conflict']) settingsDropdowns['settings-upload-conflict'].value = uploadConflict;
    if (settingsDropdowns['settings-auto-lock']) settingsDropdowns['settings-auto-lock'].value = autoLock;
    if (settingsDropdowns['settings-playlist-position']) settingsDropdowns['settings-playlist-position'].value = playlistPosition;

    // 更新视图切换按钮
    document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === defaultView);
    });

    // 应用播放列表位置
    applyPlaylistPosition(playlistPosition);
}

// 保存设置
function saveSettings() {
    localStorage.setItem('defaultSort', settingsDropdowns['settings-default-sort'] ? settingsDropdowns['settings-default-sort'].value : 'name');
    localStorage.setItem('showHidden', document.getElementById('settings-show-hidden').checked);
    localStorage.setItem('uploadConflict', settingsDropdowns['settings-upload-conflict'] ? settingsDropdowns['settings-upload-conflict'].value : 'rename');
    localStorage.setItem('autoLock', settingsDropdowns['settings-auto-lock'] ? settingsDropdowns['settings-auto-lock'].value : '0');
    localStorage.setItem('playlistPosition', settingsDropdowns['settings-playlist-position'] ? settingsDropdowns['settings-playlist-position'].value : 'left');
    showToast('设置已保存', 'success');
}

// 应用播放列表位置
function applyPlaylistPosition(position) {
    const dropdown = document.getElementById('audio-player-dropdown');
    if (dropdown) {
        dropdown.setAttribute('data-position', position);
    }
}

// ===== 回到顶部按钮功能 =====
const backToTopBtn = document.getElementById('back-to-top');
const contentArea = document.getElementById('content-area');

// 监听滚动事件，显示/隐藏回到顶部按钮
if (contentArea && backToTopBtn) {
    contentArea.addEventListener('scroll', function() {
        if (contentArea.scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    // 点击回到顶部
    backToTopBtn.addEventListener('click', function() {
        contentArea.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

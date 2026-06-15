const API_BASE = "";

let currentPath = "/";
let selectedFile = null;
let selectedFiles = [];
let lastSelectedIndex = -1;
let clipboard = { action: null, sourcePaths: [] };
let sortField = "name";
let sortOrder = "asc";
let navHistory = ["/"];
let navIndex = 0;
let currentImageList = [];
let currentImageIndex = -1;
let isSearching = false;
let searchQuery = "";
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'light';
let authToken = localStorage.getItem('authToken') || '';
let serverInfoCache = null;
let audioPlaylist = [];
let currentAudioIndex = -1;
let audioPlayMode = 'sequential';

const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"];

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragSelectionBox = null;

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

function sortFiles(files) {
    if (!files || files.length === 0) return [];


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

async function apiCall(url, options = {}) {
    try {

        if (authToken) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(API_BASE + url, options);
        const data = await response.json();


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

function authFetch(url, options = {}) {
    if (authToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(API_BASE + url, options);
}

function authXHR() {
    const xhr = new XMLHttpRequest();
    return xhr;
}

function loadFiles(path) {
    currentPath = path;
    isSearching = false;
    searchQuery = "";
    apiCall(`/api/list?path=${encodeURIComponent(path)}`)
        .then(data => {
            if (data.success) {

                currentAllFiles = data.data.files;

                document.getElementById("search-input").value = "";
                document.getElementById("search-clear-btn").classList.remove("visible");

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

function searchFiles(query, path = currentPath, recursive = true) {
    if (!query || query.trim() === "") {
        isSearching = false;
        searchQuery = "";
        loadFiles(currentPath);
        return;
    }

    isSearching = true;
    searchQuery = query.trim();


    const container = document.getElementById("file-container");
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><div class="loading-text">搜索中...</div></div>';

    apiCall(`/api/search?q=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(path)}&recursive=${recursive}`)
        .then(data => {
            if (data.success) {
                currentAllFiles = data.data.files;
                renderFiles(sortFiles(currentAllFiles));


                const info = document.getElementById("file-count-info");
                if (info) {
                    info.textContent = `找到 ${data.data.count} 个匹配项`;
                }


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


    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif", "avif"];
    currentImageList = files.filter(f => !f.isDir && imageExts.includes(f.name.split(".").pop().toLowerCase()));

    const isListView = container.classList.contains("list-view");


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


    if (shiftKey && lastSelectedIndex >= 0) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);

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

function updateSelectionInfo() {
    const info = document.getElementById("selected-file-info");
    const downloadBtn = document.getElementById("download-btn");

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
        selectedFile = selectedFiles[0];
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
    }
}

function clearSelection() {
    document.querySelectorAll(".file-item.selected").forEach(item => item.classList.remove("selected"));
    selectedFiles = [];
    selectedFile = null;
    lastSelectedIndex = -1;
    const info = document.getElementById("selected-file-info");
    if (info) info.textContent = "";
}

function setupDragSelection() {
    const contentArea = document.getElementById("content-area");
    const fileContainer = document.getElementById("file-container");


    dragSelectionBox = document.createElement("div");
    dragSelectionBox.className = "drag-selection-box";
    dragSelectionBox.style.display = "none";
    contentArea.appendChild(dragSelectionBox);

    let startX, startY;
    let hasMoved = false;


    contentArea.addEventListener("mousedown", function(e) {

        if (e.target.closest(".file-item") || e.target.closest(".toolbar")) {
            return;
        }


        if (e.button !== 0) return;

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;


        clearSelection();


        dragSelectionBox.style.display = "block";
        dragSelectionBox.style.left = startX + "px";
        dragSelectionBox.style.top = startY + "px";
        dragSelectionBox.style.width = "0px";
        dragSelectionBox.style.height = "0px";

        e.preventDefault();
    });


    document.addEventListener("mousemove", function(e) {
        if (!isDragging) return;

        const currentX = e.clientX;
        const currentY = e.clientY;


        if (!hasMoved && Math.abs(currentX - startX) < 3 && Math.abs(currentY - startY) < 3) {
            return;
        }
        hasMoved = true;


        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        dragSelectionBox.style.left = left + "px";
        dragSelectionBox.style.top = top + "px";
        dragSelectionBox.style.width = width + "px";
        dragSelectionBox.style.height = height + "px";


        selectItemsInBox(left, top, width, height);
    });


    document.addEventListener("mouseup", function(e) {
        if (!isDragging) return;


        if (!hasMoved) {
            clearSelection();
        }

        dragSelectionBox.style.display = "none";
        dragSelectionBox.style.width = "0px";
        dragSelectionBox.style.height = "0px";


        setTimeout(() => {
            isDragging = false;
        }, 50);
    });
}

function selectItemsInBox(left, top, width, height) {
    const fileItems = document.querySelectorAll(".file-item");
    const boxRect = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
    };


    selectedFiles = [];

    fileItems.forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();


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
        childContainer.offsetHeight;
        childContainer.classList.add("collapsed");
        childContainer.style.maxHeight = "0px";
        toggleIcon.className = "fas fa-chevron-right tree-toggle";
    }
}

function calculateStorage() {

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

function checkStorageSpace(files) {
    return apiCall('/api/storage')
        .then(data => {
            if (!data.success) return false;
            const usedSize = data.data.usedSize;
            const maxSize = data.data.maxSize;


            let totalSize = 0;
            for (const file of files) {
                totalSize += file.size;
            }


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

function uploadFiles() {

    if (!currentUser) {
        showToast('请先登录后再上传文件', 'error');
        return;
    }

    const fileInput = document.getElementById("file-input");
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast("请选择要上传的文件", "error");
        return;
    }


    const files = Array.from(fileInput.files);
    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }


        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;

        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {

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

                setTimeout(uploadBatch, 100);
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");

                currentBatch++;
                setTimeout(uploadBatch, 1000);
            };

            xhr.send(formData);
        }


        uploadBatch();
    });
}

function uploadFolder() {

    if (!currentUser) {
        showToast('请先登录后再上传文件夹', 'error');
        return;
    }

    const folderInput = document.getElementById("folder-input");
    if (!folderInput.files || folderInput.files.length === 0) {
        showToast("请选择要上传的文件夹", "error");
        return;
    }


    const files = Array.from(folderInput.files);
    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }


        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;

        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("folder-upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {

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

                setTimeout(uploadBatch, 100);
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");

                currentBatch++;
                setTimeout(uploadBatch, 1000);
            };

            xhr.send(formData);
        }


        uploadBatch();
    });
}

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


        const items = e.dataTransfer.items;
        if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            const entries = [];
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) entries.push(entry);
            }

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


        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
    });
}

async function traverseEntries(entries, basePath) {
    const files = [];
    for (const entry of entries) {
        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));

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

function uploadDroppedFiles(files, targetPath) {

    if (!currentUser) {
        showToast('请先登录后再上传文件', 'error');
        return;
    }


    checkStorageSpace(files).then(hasSpace => {
        if (!hasSpace) {
            return;
        }


        const batchSize = 100;
        const totalBatches = Math.ceil(files.length / batchSize);
        let currentBatch = 0;
        let uploadedCount = 0;
        let failedCount = 0;

        const uploadSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        const progressDiv = document.getElementById("upload-progress");
        const progressBar = progressDiv.querySelector(".progress-bar-fill");
        const progressText = progressDiv.querySelector(".progress-text");
        progressDiv.style.display = "block";
        progressBar.classList.add("progress-bar-animated");

        function uploadBatch() {
            if (currentBatch >= totalBatches) {

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

                setTimeout(uploadBatch, 100);
            };

            xhr.onerror = function() {
                failedCount += batchFiles.length;
                showToast("上传失败，正在重试...", "error");

                currentBatch++;
                setTimeout(uploadBatch, 1000);
            };

            xhr.send(formData);
        }


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

function downloadFile(path) {

    authFetch(`/api/download?path=${encodeURIComponent(path)}`)
        .then(response => {
            if (!response.ok) throw new Error('下载失败');
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

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


    if (selectedFiles.length === 1 && !selectedFiles[0].isDir) {
        showToast("正在准备下载...", "info");
        downloadFile(selectedFiles[0].path);
        return;
    }


    showToast("正在打包文件，请稍候...", "info");


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

function batchDeleteFiles(paths) {

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

function openMoveCopyModal() {

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

        let nextSibling = item.nextElementSibling;
        while (nextSibling && nextSibling.classList.contains("dest-tree-children")) {
            nextSibling.remove();
            nextSibling = item.nextElementSibling;
        }
    } else {
        destExpandedPaths.add(path);
        const toggleIcon = item.querySelector(".dest-tree-toggle");
        toggleIcon.classList.add("expanded");

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

                searchDestRecursive(dir.path, query, results);
            });


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

function canPreviewFile(name) {

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

function openFile(path, name) {
    previewFile(path, name);
}

function showContextMenu(x, y, file) {
    const contextMenu = document.getElementById("context-menu");
    contextMenu.classList.add("active");


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


    dividers.forEach(div => {
        div.style.display = '';
    });
}

function hideContextMenu() {
    document.getElementById("context-menu").classList.remove("active");
}

function handleContextMenuAction(action) {
    if (selectedFiles.length === 0) return;


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

function playAudio(url, name, path) {
    const audioPlayer = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');
    const audioTitle = document.getElementById('audio-player-title');
    const audioArtist = document.getElementById('audio-player-artist');


    audioPlayer.style.display = 'flex';


    const currentDir = path.substring(0, path.lastIndexOf('/')) || '/';
    loadFolderAudioFiles(currentDir, path);


    audioElement.src = url;
    audioTitle.textContent = name;


    const artistMatch = name.match(/^(.+?)\s*[-–]\s*.+$/);
    if (artistMatch) {
        audioArtist.textContent = artistMatch[1];
    } else {
        audioArtist.textContent = '未知艺术家';
    }


    audioElement.play().catch(err => {
        console.error('播放失败:', err);
        showToast('音频播放失败，请检查文件格式', 'error');
    });
}

function loadFolderAudioFiles(dirPath, currentPath) {

    audioPlaylist = [];


    if (currentAllFiles && currentAllFiles.length > 0) {
        currentAllFiles.forEach(file => {
            if (!file.isDir) {
                const fileExt = file.name.split('.').pop().toLowerCase();


                if (audioExts.includes(fileExt)) {

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


    currentAudioIndex = audioPlaylist.findIndex(item => item.path === currentPath);
}

function closeAudioPlayer() {
    const audioPlayer = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');


    audioElement.pause();
    audioElement.src = '';


    audioPlayer.style.display = 'none';


    audioPlaylist = [];
    currentAudioIndex = -1;
}

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


    closeBtn.addEventListener('click', closeAudioPlayer);


    playlistBtn.addEventListener('click', function() {
        const dropdown = document.getElementById('audio-player-dropdown');
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            updatePlaylistDropdown();
        }
    });


    document.getElementById('audio-player-dropdown-close').addEventListener('click', function() {
        document.getElementById('audio-player-dropdown').classList.remove('show');
    });


    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('audio-player-dropdown');
        const playlistBtn = document.getElementById('audio-player-playlist');
        if (!dropdown.contains(e.target) && !playlistBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });


    document.getElementById('audio-player-dropdown-close').addEventListener('click', function() {
        document.getElementById('audio-player-dropdown').classList.remove('show');
    });


    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('audio-player-dropdown');
        const playlistBtn = document.getElementById('audio-player-playlist');
        if (!dropdown.contains(e.target) && !playlistBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });


    modeBtn.addEventListener('click', togglePlayMode);


    playBtn.addEventListener('click', togglePlayPause);


    prevBtn.addEventListener('click', playPrevAudio);


    nextBtn.addEventListener('click', playNextAudio);


    volumeBtn.addEventListener('click', toggleMute);


    volumeInput.addEventListener('input', function() {
        audioElement.volume = this.value / 100;
        updateVolumeIcon(audioElement.volume);
    });


    progressInput.addEventListener('input', function() {
        const time = (this.value / 100) * audioElement.duration;
        audioElement.currentTime = time;
    });


    audioElement.addEventListener('timeupdate', updateProgress);


    audioElement.addEventListener('loadedmetadata', function() {
        document.getElementById('audio-total-time').textContent = formatTime(audioElement.duration);
    });


    audioElement.addEventListener('ended', function() {
        playNextAudio();
    });


    audioElement.addEventListener('play', function() {
        playBtn.querySelector('i').className = 'fas fa-pause';
    });

    audioElement.addEventListener('pause', function() {
        playBtn.querySelector('i').className = 'fas fa-play';
    });
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

function togglePlayPause() {
    const audioElement = document.getElementById('audio-element');
    if (audioElement.paused) {
        audioElement.play();
    } else {
        audioElement.pause();
    }
}

function playPrevAudio() {
    if (audioPlaylist.length === 0) return;

    let prevIndex;

    switch(audioPlayMode) {
        case 'random':

            do {
                prevIndex = Math.floor(Math.random() * audioPlaylist.length);
            } while (prevIndex === currentAudioIndex && audioPlaylist.length > 1);
            break;
        case 'loop':

            prevIndex = currentAudioIndex;
            break;
        case 'sequential':
        default:

            prevIndex = (currentAudioIndex - 1 + audioPlaylist.length) % audioPlaylist.length;
            break;
    }

    const prevAudio = audioPlaylist[prevIndex];
    playAudio(prevAudio.url, prevAudio.name, prevAudio.path);
}

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

function togglePlayMode() {
    const modeBtn = document.getElementById('audio-player-mode');
    const modes = ['sequential', 'random', 'loop'];
    const currentIndex = modes.indexOf(audioPlayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    audioPlayMode = modes[nextIndex];


    modeBtn.dataset.mode = audioPlayMode;
    modeBtn.classList.add('active');


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

function playNextAudio() {
    if (audioPlaylist.length === 0) return;

    let nextIndex;

    switch(audioPlayMode) {
        case 'random':

            do {
                nextIndex = Math.floor(Math.random() * audioPlaylist.length);
            } while (nextIndex === currentAudioIndex && audioPlaylist.length > 1);
            break;
        case 'loop':

            nextIndex = currentAudioIndex;
            break;
        case 'sequential':
        default:

            nextIndex = (currentAudioIndex + 1) % audioPlaylist.length;
            if (nextIndex === 0 && currentAudioIndex !== -1) {

                return;
            }
            break;
    }

    const nextAudio = audioPlaylist[nextIndex];
    playAudio(nextAudio.url, nextAudio.name, nextAudio.path);
}

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


    const modal = document.getElementById('preview-modal');


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

function playAudioFromPlaylist(index) {
    const item = audioPlaylist[index];
    if (item) {
        playAudio(item.url, item.name, item.path);
        closeModal('preview-modal');
        document.getElementById('audio-player-dropdown').classList.remove('show');
    }
}

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

        currentImageIndex = currentImageList.findIndex(f => f.path === path);

        const img = document.createElement("img");
        img.alt = name;

        img.src = previewUrl;
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


        img.onload = function() {
            var container = modal.querySelector(".preview-container");
            if (!container) return;

        };


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

            video.src = previewUrl;
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;
            video.style.width = "100%";
            video.style.maxHeight = "100%";
            video.style.objectFit = "contain";


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

        playAudio(previewUrl, name, path);
        return;
    } else if (pdfExts.includes(ext)) {
        const iframe = document.createElement("iframe");

        iframe.src = previewUrl;
        body.appendChild(iframe);
    } else if (officeExts.includes(ext)) {


        const fullPreviewUrl = window.location.origin + previewUrl + (authToken ? '&token=' + encodeURIComponent(authToken) : '');
        const iframe = document.createElement("iframe");
        iframe.src = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(fullPreviewUrl);
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "var(--radius-sm)";
        iframe.style.flex = "1";

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


                if (typeof hljs !== "undefined") {

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

    var editorBody = document.getElementById("editor-body");
    if (editorBody && editorBody.style.display !== "none") {
        closeEditor();
        return;
    }
    const modal = document.getElementById("preview-modal");
    const body = document.getElementById("preview-body");

    const media = body.querySelector("video, audio");
    if (media) media.pause();
    body.innerHTML = "";

    modal.onwheel = null;

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

    var fsBtn = document.getElementById("preview-fullscreen-btn");
    if (fsBtn) {
        var icon = fsBtn.querySelector("i");
        var label = fsBtn.querySelector("span");
        if (icon) icon.className = "fas fa-expand";
        if (label) label.textContent = "全屏";
    }
    closeModal("preview-modal");
}

function navigatePrevImage() {
    if (currentImageList.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentImageList.length) % currentImageList.length;
    const file = currentImageList[currentImageIndex];
    previewFile(file.path, file.name);
}

function navigateNextImage() {
    if (currentImageList.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentImageList.length;
    const file = currentImageList[currentImageIndex];
    previewFile(file.path, file.name);
}

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

    const textarea = document.getElementById("editor-textarea");
    const checkSave = setInterval(function() {
        if (textarea.dataset.modified !== "true") {
            clearInterval(checkSave);
            closeEditor(true);
        }
    }, 100);

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

        const container = modal.querySelector(".preview-container, .editor-container");
        if (container) {
            container.style.position = "";
            container.style.left = "";
            container.style.top = "";
            container.style.margin = "";
            container.style.width = "";
            container.style.height = "";
        }

        const anyActive = document.querySelector(".modal-overlay.active");
        if (!anyActive) {
            document.body.style.overflow = "";
        }
    }
}

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


            if (direction === "l" || direction === "lt" || direction === "lb") {
                var newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - diffX));
                container.style.width = newWidth + "px";
                container.style.left = (startLeft + startWidth - newWidth) + "px";
            }


            if (direction === "r" || direction === "rt" || direction === "rb") {
                var newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diffX));
                container.style.width = newWidth + "px";
            }


            if (direction === "t" || direction === "lt" || direction === "rt") {
                var newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - diffY));
                container.style.height = newHeight + "px";
                container.style.top = (startTop + startHeight - newHeight) + "px";
            }


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


    document.querySelectorAll(".preview-header, .editor-header").forEach(function(header) {
        var container = header.closest(".preview-container, .editor-container");
        if (!container) return;

        var isDragging = false;
        var startX, startY, startLeft, startTop;

        header.addEventListener("mousedown", function(e) {

            if (e.target.closest("button")) return;

            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            var rect = container.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;


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

function setupEventListeners() {

    document.getElementById("back-btn").addEventListener("click", goBack);
    document.getElementById("forward-btn").addEventListener("click", goForward);
    document.getElementById("up-btn").addEventListener("click", goUp);


    document.getElementById("download-btn").addEventListener("click", function() {
        downloadSelectedFiles();
    });


    (function() {
        var qrPopup = document.getElementById('qr-popup');
        var qrPopupBody = document.getElementById('qr-popup-body');
        var qrInstance = null;
        var qrTimer = null;
        var currentQrUrl = '';

        function getDownloadUrl() {
            if (selectedFiles.length === 0) return '';
            var baseUrl = window.location.origin;


            var selectedAddressType = localStorage.getItem('selectedAddressType') || 'ipv4';
            if (serverInfoCache) {
                if (selectedAddressType === 'ipv4' && serverInfoCache.ipv4) {
                    baseUrl = baseUrl.replace(/\/\/([^\/:]+)(:\d+)?/, "//" + serverInfoCache.ipv4 + "$2");
                } else if (selectedAddressType === 'ipv6' && serverInfoCache.ipv6) {
                    var ipv6Addr = serverInfoCache.ipv6.replace(/[\[\]]/g, '');
                    baseUrl = baseUrl.replace(/\/\/([^\/:]+)(:\d+)?/, "//[" + ipv6Addr + "]$2");
                }
            }

            var url;
            if (selectedFiles.length === 1) {

                url = baseUrl + '/api/d?path=' + encodeURIComponent(selectedFiles[0].path);
            } else {

                var pathsParam = selectedFiles.map(function(f){ return f.path; }).join(',');
                url = baseUrl + '/api/d?paths=' + encodeURIComponent(pathsParam);
            }


            if (authToken) {
                url += '&token=' + encodeURIComponent(authToken);
            }
            return url;
        }

        function showQrPopup(btn) {
            var url = getDownloadUrl();
            if (!url) return;


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


            var rect = btn.getBoundingClientRect();
            var popupWidth = 210;
            var popupHeight = 280;
            var left = rect.left + rect.width / 2 - popupWidth / 2;
            var top = rect.bottom + 10;


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

            if (window.innerWidth <= 768) return;
            clearTimeout(qrTimer);
            qrTimer = setTimeout(function() { showQrPopup(downloadBtn); }, 300);
        });
        downloadBtn.addEventListener('mouseleave', function() {
            clearTimeout(qrTimer);
            hideQrPopup();
        });

        downloadBtn.addEventListener('click', function() {
            hideQrPopup();
        });
    })();


    var uploadFileMenu = document.getElementById("upload-file-menu");
    if (uploadFileMenu) uploadFileMenu.addEventListener("click", function(e) {
        e.preventDefault();

        document.getElementById("file-input").value = "";
        document.getElementById("upload-dropzone").classList.remove("has-files");
        document.getElementById("upload-file-list").style.display = "none";
        document.getElementById("upload-dropzone-placeholder").style.display = "";
        document.getElementById("upload-progress").style.display = "none";
        document.querySelector("#upload-progress .progress-bar-fill").style.width = "0%";
        document.querySelector("#upload-progress .progress-text").textContent = "0%";
        openModal("upload-modal");
    });


    var uploadFolderMenu = document.getElementById("upload-folder-menu");
    if (uploadFolderMenu) uploadFolderMenu.addEventListener("click", function(e) {
        e.preventDefault();

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


    var createFolderMenu = document.getElementById("create-folder-menu");
    if (createFolderMenu) createFolderMenu.addEventListener("click", function(e) {
        e.preventDefault();
        openModal("folder-modal");
        document.getElementById("folder-name-input").value = "";
        setTimeout(() => document.getElementById("folder-name-input").focus(), 100);
    });


    var createFileMenu = document.getElementById("create-file-menu");
    if (createFileMenu) createFileMenu.addEventListener("click", function(e) {
        e.preventDefault();
        openModal("create-file-modal");
        document.getElementById("create-file-name-input").value = "";
        setTimeout(() => document.getElementById("create-file-name-input").focus(), 100);
    });


    document.getElementById("upload-confirm-btn").addEventListener("click", uploadFiles);
    document.getElementById("upload-folder-confirm-btn").addEventListener("click", uploadFolder);


    document.getElementById("create-folder-confirm-btn").addEventListener("click", createFolder);


    document.getElementById("create-file-confirm-btn").addEventListener("click", createFile);


    document.getElementById("rename-confirm-btn").addEventListener("click", renameFile);


    document.getElementById("move-copy-confirm-btn").addEventListener("click", moveOrCopyFile);


    setupDropzone("upload-dropzone", "file-input");
    setupDropzone("folder-dropzone", "folder-input");


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


    document.querySelectorAll(".modal-close-btn, .modal-cancel").forEach(btn => {
        btn.addEventListener("click", function() {
            const modal = this.closest(".modal-overlay");
            if (modal) closeModal(modal.id);
        });
    });


    window.addEventListener("click", function(event) {


        if (event.target.closest(".modal-dialog, .preview-container, .editor-container")) {
            return;
        }
        if (event.target.classList.contains("modal-overlay")) {

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


    document.getElementById("preview-close-btn").addEventListener("click", closePreview);


    document.getElementById("preview-fullscreen-btn").addEventListener("click", function() {
        var container = document.querySelector(".preview-container");
        if (!container) return;
        var btn = document.getElementById("preview-fullscreen-btn");
        var icon = btn.querySelector("i");
        var label = btn.querySelector("span");
        if (container.classList.contains("preview-fullscreen")) {

            container.classList.remove("preview-fullscreen");
            icon.className = "fas fa-expand";
            label.textContent = "全屏";
        } else {

            container.classList.add("preview-fullscreen");
            icon.className = "fas fa-compress";
            label.textContent = "退出";
        }
    });


    document.getElementById("editor-save-btn").addEventListener("click", saveFile);


    document.getElementById("unsaved-save-btn").addEventListener("click", closeEditorSave);
    document.getElementById("unsaved-discard-btn").addEventListener("click", closeEditorDiscard);
    document.getElementById("unsaved-cancel-btn").addEventListener("click", closeEditorCancel);

    const editorTextarea = document.getElementById("editor-textarea");
    const editorHighlight = document.getElementById("editor-highlight");


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

            if (selectedFiles.length > 1) {
                batchDeleteFiles(selectedFiles.map(f => f.path));
            } else if (selectedFile) {
                deleteFile(selectedFile.path);
            }
        } else if (isPreviewActive) {

            if (e.key === "ArrowLeft") {
                e.preventDefault();
                navigatePrevImage();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                navigateNextImage();
            }
        }
    });


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


    document.getElementById("sidebar-overlay").addEventListener("click", function() {
        document.querySelector(".sidebar").classList.remove("mobile-open");
        this.classList.remove("active");
    });


    document.getElementById("refresh-btn").addEventListener("click", function() {
        loadFiles(currentPath);
        loadTree();
        calculateStorage();
    });


    const searchInput = document.getElementById("search-input");
    let searchTimeout = null;

    searchInput.addEventListener("input", function() {
        const query = this.value.trim();
        const clearBtn = document.getElementById("search-clear-btn");


        if (query) {
            clearBtn.classList.add("visible");
        } else {
            clearBtn.classList.remove("visible");
        }


        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query) {
                searchFiles(query, currentPath, true);
            } else {
                clearSearch();
            }
        }, 500);
    });


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


    document.getElementById("search-clear-btn").addEventListener("click", function() {
        clearSearch();
        searchInput.blur();
    });


    document.addEventListener("click", function(e) {
        if (!searchInput.closest('.file-toolbar-search').contains(e.target)) {
            searchInput.blur();
        }
    });


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


    document.getElementById("content-area").addEventListener("click", function(e) {

        if (e.target.closest(".drag-selection-box") || isDragging) {
            return;
        }
        if (e.target === this || e.target === document.getElementById("file-container")) {
            clearSelection();
        }
    });


    document.getElementById("folder-name-input").addEventListener("keydown", function(e) {
        if (e.key === "Enter") createFolder();
    });
    document.getElementById("rename-input").addEventListener("keydown", function(e) {
        if (e.key === "Enter") renameFile();
    });
}

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

['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function(evt) {
    document.addEventListener(evt, resetAutoLockTimer, { passive: true });
});

function applyDefaultSettings() {

    const defaultSort = localStorage.getItem('defaultSort');
    if (defaultSort) {
        sortField = defaultSort;
    }


    const defaultView = localStorage.getItem('defaultView') || 'grid';
    const container = document.getElementById('file-container');
    if (container) {
        container.classList.remove('grid-view', 'list-view');
        container.classList.add(defaultView + '-view');
    }

    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', defaultView === 'grid');
        listBtn.classList.toggle('active', defaultView === 'list');
    }


    const playlistPosition = localStorage.getItem('playlistPosition') || 'left';
    applyPlaylistPosition(playlistPosition);
}

async function fetchServerInfo() {
    try {
        const response = await fetch('/api/server-info');
        if (response.ok) {
            const data = await response.json();
            serverInfoCache = data.data;


            const ipv4Input = document.getElementById('settings-ipv4-address');
            const ipv6Input = document.getElementById('settings-ipv6-address');
            const ipv4Radio = document.getElementById('address-ipv4');
            const ipv6Radio = document.getElementById('address-ipv6');

            if (ipv4Input && serverInfoCache.ipv4) {
                ipv4Input.value = serverInfoCache.ipv4;
            }
            if (ipv6Input && serverInfoCache.ipv6) {
                ipv6Input.value = serverInfoCache.ipv6;
            }


            const selectedType = localStorage.getItem('selectedAddressType') || 'ipv4';
            if (ipv4Radio && ipv6Radio) {
                ipv4Radio.checked = selectedType === 'ipv4';
                ipv6Radio.checked = selectedType === 'ipv6';


                ipv4Radio.addEventListener('change', function() {
                    if (this.checked) {
                        localStorage.setItem('selectedAddressType', 'ipv4');

                        const addressButtons = document.querySelectorAll('.address-selector-btn');
                        addressButtons.forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.type === 'ipv4');
                        });
                    }
                });

                ipv6Radio.addEventListener('change', function() {
                    if (this.checked) {
                        localStorage.setItem('selectedAddressType', 'ipv6');

                        const addressButtons = document.querySelectorAll('.address-selector-btn');
                        addressButtons.forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.type === 'ipv6');
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error('Failed to fetch server info:', error);
    }
}

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

function initTopbarQrCode() {
    const wrapper = document.querySelector('.topbar-qrcode-wrapper');
    const qrBody = document.getElementById('topbar-qrcode-body');
    if (!wrapper || !qrBody) return;

    let qrInstance = null;
    let currentUrl = '';
    let selectedAddressType = localStorage.getItem('selectedAddressType') || 'ipv4';


    const addressButtons = wrapper.querySelectorAll('.address-selector-btn');
    addressButtons.forEach(btn => {
        if (btn.dataset.type === selectedAddressType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        btn.addEventListener('click', function() {
            addressButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedAddressType = this.dataset.type;
            localStorage.setItem('selectedAddressType', selectedAddressType);


            const ipv4Radio = document.getElementById('address-ipv4');
            const ipv6Radio = document.getElementById('address-ipv6');
            if (ipv4Radio && ipv6Radio) {
                ipv4Radio.checked = selectedAddressType === 'ipv4';
                ipv6Radio.checked = selectedAddressType === 'ipv6';
            }

            generateQr();
        });
    });

    function getQrUrl() {

        let url = window.location.href;


        url = url.replace(/[?&]token=[^&]*/, '');


        url = url.replace(/[?&]$/, '');


        if (serverInfoCache) {

            if (selectedAddressType === 'ipv4' && serverInfoCache.ipv4) {

                url = url.replace(/\/\/([^\/:]+)(:\d+)?/, "//" + serverInfoCache.ipv4 + "$2");
            } else if (selectedAddressType === 'ipv6' && serverInfoCache.ipv6) {
                const ipv6Addr = serverInfoCache.ipv6.replace(/[\[\]]/g, '');

                url = url.replace(/\/\/([^\/:]+)(:\d+)?/, "//[" + ipv6Addr + "]$2");
            }
        }


        if (authToken) {

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

document.addEventListener("DOMContentLoaded", async function() {

    initTheme();

    applyDefaultSettings();

    initUserMenu();

    initAudioPlayer();

    await checkLoginStatus();

    loadFiles(currentPath);
    setupEventListeners();
    setupDragSelection();
    loadTree();
    setupRootTreeToggle();
    calculateStorage();
    initResizeHandles();

    await fetchServerInfo();

    initTopbarQrCode();

    resetAutoLockTimer();
});

async function checkLoginStatus() {

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {

        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);

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

            const response = await apiCall('/api/verify-token', {
                method: 'GET'
            });

            if (response.success) {
                authToken = savedToken;
                currentUser = JSON.parse(savedUser);
                updateUserInfo();

                document.querySelector('.app').classList.add('app-ready');
                hideLoginModal();
            } else {

                currentUser = null;
                authToken = '';
                localStorage.removeItem('currentUser');
                localStorage.removeItem('authToken');
                updateUserInfo();
                showLoginModal();
            }
        } catch (error) {
            console.error('Token verification error:', error);

            currentUser = null;
            authToken = '';
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            updateUserInfo();
            showLoginModal();
        }
    } else {

        currentUser = null;
        authToken = '';
        updateUserInfo();
        showLoginModal();
    }
}

function showLoginModal() {
    const page = document.getElementById('login-page');
    page.classList.remove('hidden');

    document.querySelector('.app').classList.remove('app-ready');
    setTimeout(() => {
        document.getElementById('login-username').focus();
    }, 100);
}

function hideLoginModal() {
    const page = document.getElementById('login-page');
    page.classList.add('hidden');

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

        await apiCall('/api/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }


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

    updateAuthUI();
}

function updateAuthUI() {
    const isLoggedIn = currentUser !== null;
    const isAdmin = currentUser && (currentUser.type === 'root' || currentUser.type === 'admin');
    const isRoot = currentUser && currentUser.type === 'root';


    document.querySelectorAll('[data-auth]').forEach(el => {
        const authLevel = el.getAttribute('data-auth');
        let hasPermission = false;
        if (authLevel === 'user' && isLoggedIn) hasPermission = true;
        if (authLevel === 'admin' && isAdmin) hasPermission = true;
        if (authLevel === 'root' && isRoot) hasPermission = true;

        if (hasPermission) {
            el.classList.remove('auth-disabled', 'auth-hidden');
            el.removeAttribute('data-auth-denied');

            const li = el.closest('li');
            if (li) li.classList.remove('auth-hidden');
        } else {

            const isMenuItem = el.classList.contains('dropdown-item') || el.classList.contains('user-menu-item');

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

function initTheme() {
    applyTheme(currentTheme);
    updateThemeButtons();

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

    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    if (topbarThemeBtn) {
        topbarThemeBtn.querySelector('i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    showToast(`已切换到${theme === 'dark' ? '深色' : '浅色'}模式`, 'info');
}

function initUserMenu() {

    document.getElementById('login-confirm-btn').addEventListener('click', handleLogin);


    document.getElementById('user-info').addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentUser) {
            showLoginModal();
        } else {
            showProfileModal();
        }
    });


    document.getElementById('logout-menu').addEventListener('click', function(e) {
        e.preventDefault();
        handleLogout();
    });


    document.getElementById('settings-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showSettingsModal();
    });


    document.getElementById('about-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showAboutModal();
    });


    document.getElementById('security-menu').addEventListener('click', function(e) {
        e.preventDefault();
        showSecurityModal();
    });


    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            handleThemeChange(theme);
        });
    });


    document.getElementById('topbar-theme-btn').addEventListener('click', function() {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        handleThemeChange(newTheme);

        this.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });


    document.getElementById('settings-back-btn').addEventListener('click', hideSettingsModal);


    document.getElementById('profile-back-btn').addEventListener('click', hideProfileModal);


    document.getElementById('profile-displayname').addEventListener('input', onProfileDisplayNameChange);


    document.getElementById('profile-change-password-btn').addEventListener('click', changeProfilePassword);


    document.getElementById('about-back-btn').addEventListener('click', hideAboutModal);


    document.getElementById('security-back-btn').addEventListener('click', hideSecurityModal);


    document.getElementById('security-save-config').addEventListener('click', saveSecurityConfig);


    document.getElementById('security-add-user-btn').addEventListener('click', function() {
        openUserEditModal(null, '', 'user');
    });


    document.getElementById('user-edit-modal-close').addEventListener('click', closeUserEditModal);
    document.getElementById('user-edit-cancel-btn').addEventListener('click', closeUserEditModal);


    document.getElementById('user-edit-save-btn').addEventListener('click', saveUser);


    document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.settings-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            var view = this.getAttribute('data-view');
            localStorage.setItem('defaultView', view);

            var container = document.getElementById('file-container');
            container.classList.remove('grid-view', 'list-view');
            container.classList.add(view + '-view');
            var gridBtn = document.getElementById('grid-view-btn');
            var listBtn = document.getElementById('list-view-btn');
            if (gridBtn) gridBtn.classList.toggle('active', view === 'grid');
            if (listBtn) listBtn.classList.toggle('active', view === 'list');
        });
    });


    initSettingsDropdowns();


    document.getElementById('settings-show-hidden').addEventListener('change', function() {
        localStorage.setItem('showHidden', this.checked);

        renderFiles(sortFiles(currentAllFiles));
    });


    document.getElementById('settings-clear-cache').addEventListener('click', function() {
        localStorage.removeItem('defaultSort');
        localStorage.removeItem('showHidden');
        localStorage.removeItem('uploadConflict');
        localStorage.removeItem('autoLock');
        localStorage.removeItem('defaultView');
        loadSettings();
        applyDefaultSettings();
        resetAutoLockTimer();

        renderFiles(sortFiles(currentAllFiles));
        showToast('缓存已清除', 'success');
    });


    document.getElementById('login-username').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
}

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


    avatar.className = 'profile-avatar ' + currentUser.type;
    if (currentUser.type === 'root') {
        avatar.innerHTML = '<i class="fas fa-crown"></i>';
    } else if (currentUser.type === 'admin') {
        avatar.innerHTML = '<i class="fas fa-user-shield"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-user-circle"></i>';
    }


    displayname.textContent = currentUser.displayName || currentUser.username;


    const typeLabels = { root: 'Root', admin: '管理员', user: '普通用户' };
    typeBadge.className = 'profile-type-badge ' + currentUser.type;
    typeBadge.textContent = typeLabels[currentUser.type] || currentUser.type;


    account.textContent = '@' + currentUser.username;


    displaynameInput.value = currentUser.displayName || '';


    document.getElementById('profile-old-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
}

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

    updateAuthUI();

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

let securityConfig = null;
let editingUsername = null;

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


    container.querySelectorAll('[data-username]').forEach(btn => {
        btn.addEventListener('click', function() {
            openUserEditModal(
                this.dataset.username,
                this.dataset.displayname,
                this.dataset.type
            );
        });
    });


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


        trigger.addEventListener('click', function(e) {
            e.stopPropagation();

            document.querySelectorAll('.settings-dropdown-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });


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


    document.addEventListener('click', function() {
        document.querySelectorAll('.settings-dropdown-wrapper.open').forEach(w => {
            w.classList.remove('open');
        });
    });
}

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


    document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === defaultView);
    });


    applyPlaylistPosition(playlistPosition);
}

function saveSettings() {
    localStorage.setItem('defaultSort', settingsDropdowns['settings-default-sort'] ? settingsDropdowns['settings-default-sort'].value : 'name');
    localStorage.setItem('showHidden', document.getElementById('settings-show-hidden').checked);
    localStorage.setItem('uploadConflict', settingsDropdowns['settings-upload-conflict'] ? settingsDropdowns['settings-upload-conflict'].value : 'rename');
    localStorage.setItem('autoLock', settingsDropdowns['settings-auto-lock'] ? settingsDropdowns['settings-auto-lock'].value : '0');
    localStorage.setItem('playlistPosition', settingsDropdowns['settings-playlist-position'] ? settingsDropdowns['settings-playlist-position'].value : 'left');
    showToast('设置已保存', 'success');
}

function applyPlaylistPosition(position) {
    const dropdown = document.getElementById('audio-player-dropdown');
    if (dropdown) {
        dropdown.setAttribute('data-position', position);
    }
}

const backToTopBtn = document.getElementById('back-to-top');
const contentArea = document.getElementById('content-area');

if (contentArea && backToTopBtn) {
    contentArea.addEventListener('scroll', function() {
        if (contentArea.scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });


    backToTopBtn.addEventListener('click', function() {
        contentArea.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

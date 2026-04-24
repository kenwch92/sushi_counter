
        const STORAGE_KEY = "sushi_calculator_data";
        const initialDefaults = [
            { name: "紅碟", dish: 0, price: 12, color: "#AE303A" },
            { name: "銀碟", dish: 0, price: 17, color: "#DCDEDB" },
            { name: "金碟", dish: 0, price: 22, color: "#E1C268" },
            { name: "黑碟", dish: 0, price: 27, color: "#0F0A08" }
        ];

        let state = { calcs: [], globalPerc: 10 };
        let draggedIndex = null;
        let scrollInterval = null;

        function saveState() { 
            localStorage.clear(); 
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
        }

        function initData() {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) { state = JSON.parse(saved); } 
            else { state.calcs = initialDefaults.map(item => ({ ...item })); state.globalPerc = 10; }
            document.getElementById('global-perc-input').value = state.globalPerc;
        }

        function getLightColor(hex) { return hex + "12"; }

        function initSettingsUI() {
            const panel = document.getElementById('settings-panel');
            panel.innerHTML = '';
            document.getElementById('config-count').innerText = state.calcs.length;
            
            state.calcs.forEach((item, i) => {
                const config = document.createElement('div');
                config.className = 'config-card';
                config.id = `config-item-${i}`;
                config.style.borderLeftColor = item.color;
                config.style.backgroundColor = getLightColor(item.color);
                
                config.innerHTML = `
                    <div style="flex-grow:1;">
                        <div style="margin-bottom:6px;">
                            <label style="font-size:0.65rem; font-weight:bold; color:#888;">名稱</label>
                            <input type="text" class="text-input" value="${item.name}" oninput="updateName(${i}, this.value)">
                        </div>
                        <div style="display:flex; gap:8px;">
                            <div style="flex:1;"><label style="font-size:0.65rem; font-weight:bold; color:#888;">價錢</label><input type="number" class="text-input" value="${item.price}" oninput="updatePrice(${i}, this.value)"></div>
                            <div style="width:45px;"><label style="font-size:0.65rem; font-weight:bold; color:#888;">顏色</label>
                            <input type="color" value="${item.color}" oninput="updateColorUI(${i}, this.value)" style="width:100%; border:none; height:32px; cursor:pointer; background:none; padding:0;"></div>
                        </div>
                    </div>
                    <div class="drag-handle" draggable="true" onmousedown="draggedIndex=${i}" ontouchstart="enableTouchDrag(event, ${i})">☰</div>
                    <button class="btn-delete" onclick="removeCalc(${i})">✕</button>
                `;

                const handle = config.querySelector('.drag-handle');
                handle.ondragstart = (e) => { draggedIndex = i; config.classList.add('dragging'); };
                handle.ondragend = () => config.classList.remove('dragging');
                config.ondragover = (e) => e.preventDefault();
                config.ondrop = (e) => { e.preventDefault(); reorder(draggedIndex, i); };
                panel.appendChild(config);
            });
        }

        // 優化：只更新顏色相關樣式，不重繪整個 UI 列表，防止 Color Picker 關閉
        window.updateColorUI = (i, val) => { 
            state.calcs[i].color = val; 
            const card = document.getElementById(`config-item-${i}`);
            if(card) {
                card.style.borderLeftColor = val;
                card.style.backgroundColor = getLightColor(val);
            }
            renderCalculators(); 
        };

        function enableTouchDrag(e, index) {
            const el = document.getElementById(`config-item-${index}`);
            const scrollArea = document.getElementById('modal-scroll');
            const panel = document.getElementById('settings-panel');
            const touch = e.touches[0];
            const elRect = el.getBoundingClientRect();
            const offsetX = touch.clientX - elRect.left;
            const offsetY = touch.clientY - elRect.top;
            const ghost = el.cloneNode(true);
            ghost.classList.add('drag-ghost');
            ghost.style.width = elRect.width + 'px';
            document.body.appendChild(ghost);
            el.classList.add('dragging');
            scrollArea.style.overflow = 'hidden';
            draggedIndex = index;

            const onTouchMove = (event) => {
                const t = event.touches[0];
                ghost.style.left = (t.clientX - offsetX) + 'px';
                ghost.style.top = (t.clientY - offsetY) + 'px';
                const areaRect = scrollArea.getBoundingClientRect();
                clearInterval(scrollInterval);
                if (t.clientY < areaRect.top + 100) scrollInterval = setInterval(() => { scrollArea.scrollTop -= 5; }, 16);
                else if (t.clientY > areaRect.bottom - 100) scrollInterval = setInterval(() => { scrollArea.scrollTop += 5; }, 16);
                const targetEl = document.elementFromPoint(t.clientX, t.clientY);
                const closestCard = targetEl?.closest('.config-card');
                if (closestCard && closestCard !== el) {
                    const targetIdx = Array.from(panel.children).indexOf(closestCard);
                    if (targetIdx !== -1) reorder(draggedIndex, targetIdx, false);
                }
            };

            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.ontouchend = () => {
                clearInterval(scrollInterval);
                document.removeEventListener('touchmove', onTouchMove);
                ghost.remove();
                el.classList.remove('dragging');
                scrollArea.style.overflow = 'auto';
                initSettingsUI();
            };
        }

        function reorder(from, to, refreshUI = true) {
            if (from === null || from === to) return;
            const temp = state.calcs.splice(from, 1)[0];
            state.calcs.splice(to, 0, temp);
            draggedIndex = to;
            if (refreshUI) initSettingsUI();
            renderCalculators();
        }

        function renderCalculators() {
            const grid = document.getElementById('calc-grid');
            grid.innerHTML = '';
            let baseSum = 0, totalDishes = 0;
            state.calcs.forEach((item, i) => {
                const subtotal = item.dish * item.price;
                baseSum += subtotal; totalDishes += item.dish;
                const card = document.createElement('div');
                card.className = 'card';
                card.style.borderTopColor = item.color;
                card.style.backgroundColor = getLightColor(item.color);
                card.innerHTML = `
                    <button class="btn-ctrl" onclick="changeDish(${i},-1)">−</button>
                    <div class="card-content">
                        <div class="card-label">${item.name}</div>
                        <div class="stat-line">${item.dish} <span style="font-weight:300; color:#ccc; margin:0 5px;">|</span> $${item.price}</div>
                        <div class="subtotal-line" style="color:${item.color}">$${subtotal.toLocaleString()}</div>
                    </div>
                    <button class="btn-ctrl" onclick="changeDish(${i},1)">+</button>`;
                grid.appendChild(card);
            });
            const finalTotal = baseSum * (1 + (state.globalPerc / 100));
            document.getElementById('grand-total').innerText = finalTotal.toLocaleString(undefined, { maximumFractionDigits: 1 });
            document.getElementById('sum-dish').innerText = totalDishes.toLocaleString();
            document.getElementById('perc-tag').innerText = `(+${state.globalPerc}%)`;
            saveState();
        }

        window.updateName = (i, v) => { state.calcs[i].name = v; renderCalculators(); };
        window.updatePrice = (i, v) => { state.calcs[i].price = parseFloat(v) || 0; renderCalculators(); };
        window.updateGlobalPerc = (val) => { state.globalPerc = parseFloat(val) || 0; renderCalculators(); };
        window.changeDish = (i, dir) => { state.calcs[i].dish = Math.max(0, state.calcs[i].dish + dir); renderCalculators(); };
        window.addNewCalc = () => { state.calcs.push({ name: "新項目", dish: 0, price: 0, color: "#95a5a6" }); initSettingsUI(); renderCalculators(); };
        window.removeCalc = (i) => { if(confirm("確定刪除此項目？")) { state.calcs.splice(i, 1); initSettingsUI(); renderCalculators(); }};
        window.clearCounts = () => { if(confirm("確定要清空所有碟數嗎？")) { state.calcs.forEach(c => c.dish = 0); renderCalculators(); }};
        window.resetAll = () => { if(confirm("確定要恢復預設嗎？所有自訂項目將會消失。")) { state.calcs = initialDefaults.map(item => ({ ...item })); state.globalPerc = 10; initSettingsUI(); renderCalculators(); }};

        initData();
        initSettingsUI();
        renderCalculators();
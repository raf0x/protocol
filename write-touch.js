const fs = require('fs');
let html = fs.readFileSync('public/timedodge.html', 'utf8');

const touchControls = `
    <style>
        #controls {
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            z-index: 100;
        }
        .ctrl-row { display: flex; gap: 8px; pointer-events: none; }
        .ctrl-btn {
            width: 64px;
            height: 64px;
            background: rgba(0, 255, 255, 0.15);
            border: 2px solid rgba(0, 255, 255, 0.4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: rgba(0, 255, 255, 0.8);
            pointer-events: all;
            user-select: none;
            -webkit-user-select: none;
            cursor: pointer;
        }
        .ctrl-btn:active { background: rgba(0, 255, 255, 0.35); }
        .ctrl-spacer { width: 64px; height: 64px; pointer-events: none; }
    </style>
    <div id="controls">
        <div class="ctrl-row">
            <div class="ctrl-spacer"></div>
            <div class="ctrl-btn" id="btn-up">▲</div>
            <div class="ctrl-spacer"></div>
        </div>
        <div class="ctrl-row">
            <div class="ctrl-btn" id="btn-left">◀</div>
            <div class="ctrl-btn" id="btn-down">▼</div>
            <div class="ctrl-btn" id="btn-right">▶</div>
        </div>
    </div>
    <script>
        const btnMap = {
            'btn-up':    'ArrowUp',
            'btn-down':  'ArrowDown',
            'btn-left':  'ArrowLeft',
            'btn-right': 'ArrowRight',
        };
        Object.entries(btnMap).forEach(([id, code]) => {
            const el = document.getElementById(id);
            const down = (e) => {
                e.preventDefault();
                keys[code] = true;
                if (gameState === 'start') startGame();
                else if (gameState === 'gameover') gameState = 'start';
            };
            const up = (e) => { e.preventDefault(); keys[code] = false; };
            el.addEventListener('touchstart', down, { passive: false });
            el.addEventListener('touchend', up, { passive: false });
            el.addEventListener('touchcancel', up, { passive: false });
            el.addEventListener('mousedown', down);
            el.addEventListener('mouseup', up);
            el.addEventListener('mouseleave', up);
        });
    </script>`;

html = html.replace('</body>', touchControls + '\n</body>');
fs.writeFileSync('public/timedodge.html', html, 'utf8');
console.log('Done');

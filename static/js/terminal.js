try {
    // Check if xterm.js is loaded
    if (!window.Terminal) {
        throw new Error('xterm.js not loaded');
    }

    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#000000',
            foreground: '#00ff00',
            cursor: '#00ff00'
        },
        cols: 80,  // Fallback fixed size
        rows: 24,
        scrollback: 1000
    });

    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
        console.error('Terminal element not found');
        throw new Error('Terminal element not found');
    }

    // Initialize terminal
    function initializeTerminal() {
        try {
            console.log('Opening terminal...');
            term.open(terminalElement);
            console.log('Terminal opened');

            // Optional: Try FitAddon if available
            if (window.FitAddon) {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log(`Terminal fitted: ${term.cols} cols, ${term.rows} rows`);
            } else {
                console.warn('FitAddon not loaded, using fixed size');
            }

            term.write('Aetherix ~$ ');
        } catch (e) {
            console.error('Terminal initialization error:', e);
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initializeTerminal, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeTerminal, 100);
        });
    }

    // Resize handler (if FitAddon is used)
    window.addEventListener('resize', () => {
        if (window.FitAddon) {
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log('Terminal resized');
            } catch (e) {
                console.error('Resize error:', e);
            }
        }
    });

    let prompt = '';
    term.onKey(({ key, domEvent }) => {
        try {
            if (domEvent.key === 'Enter') {
                if (prompt.trim()) {
                    fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: prompt })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                        return response.json();
                    })
                    .then(data => {
                        term.writeln('');
                        term.writeln(data.response);
                        term.write('Aetherix ~$ ');
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        term.writeln('');
                        term.writeln('Error: Connection failed');
                        term.write('Aetherix ~$ ');
                    });
                    prompt = '';
                } else {
                    term.writeln('');
                    term.write('Aetherix ~$ ');
                }
            } else if (domEvent.key === 'Backspace') {
                if (prompt.length > 0) {
                    prompt = prompt.slice(0, -1);
                    term.write('\b \b');
                }
            } else if (domEvent.key.length === 1) {
                prompt += key;
                term.write(key);
            }
        } catch (error) {
            console.error('Terminal key error:', error);
        }
    });

    term.on('focus', () => {
        console.log('Terminal focused');
    });

    term.focus();
} catch (error) {
    console.error('Terminal setup error:', error);
}

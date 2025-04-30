try {
    // Check if xterm.js is loaded
    if (!window.Terminal) {
        console.error('xterm.js not loaded');
        document.getElementById('terminal').innerHTML = 'Error: Failed to load terminal library (xterm.js). Please refresh.';
        throw new Error('xterm.js not loaded');
    }

    console.log('xterm.js loaded successfully');
    console.log('Terminal constructor:', window.Terminal);

    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#000000',
            foreground: '#00ff00',
            cursor: '#00ff00'
        },
        scrollback: 1000
    });

    console.log('Terminal instance created:', term);

    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
        console.error('Terminal element not found');
        document.body.innerHTML = 'Error: Terminal container not found.';
        throw new Error('Terminal element not found');
    }

    console.log('Terminal element found');

    // Function to calculate cols and rows based on container size
    function calculateTerminalSize() {
        const charWidth = 8;  // Approximate width of a character in pixels (Courier New)
        const charHeight = 16;  // Approximate height of a character in pixels
        const containerWidth = terminalElement.clientWidth;
        const containerHeight = terminalElement.clientHeight;
        const cols = Math.floor(containerWidth / charWidth);
        const rows = Math.floor(containerHeight / charHeight);
        console.log(`Calculated terminal size: ${cols} cols, ${rows} rows`);
        return { cols, rows };
    }

    // Initialize terminal
    function initializeTerminal() {
        try {
            console.log('Opening terminal...');
            term.open(terminalElement);
            console.log('Terminal opened successfully');

            // Calculate and set terminal size
            const { cols, rows } = calculateTerminalSize();
            term.resize(cols, rows);

            // Try FitAddon as a fallback
            if (window.FitAddon) {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);

                // Retry fitting to handle timing issues
                function fitWithRetry(attempts = 10, delay = 500) {
                    if (attempts <= 0) {
                        console.error('Failed to fit terminal after retries, using calculated size');
                        return;
                    }
                    try {
                        fitAddon.fit();
                        const { cols: fittedCols, rows: fittedRows } = term;
                        if (fittedCols > 0 && fittedRows > 0) {
                            console.log(`Terminal fitted: ${fittedCols} cols, ${fittedRows} rows`);
                            return;
                        }
                    } catch (e) {
                        console.error('Fit error:', e);
                    }
                    console.log(`Retrying fit (${attempts} attempts left)...`);
                    setTimeout(() => fitWithRetry(attempts - 1, delay), delay);
                }

                fitWithRetry();
            } else {
                console.warn('FitAddon not loaded, using calculated size');
            }

            term.write('Aetherix ~$ ');
            term.focus();
        } catch (e) {
            console.error('Terminal initialization error:', e);
            terminalElement.innerHTML = 'Error: Failed to initialize terminal: ' + e.message + '. Please refresh.';
            throw e;
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log('DOM ready, initializing terminal...');
        setTimeout(initializeTerminal, 100);
    } else {
        console.log('Waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded fired, initializing terminal...');
            setTimeout(initializeTerminal, 100);
        });
    }

    // Force resize on window load and resize
    window.addEventListener('load', () => {
        const { cols, rows } = calculateTerminalSize();
        term.resize(cols, rows);
        console.log('Terminal resized on window load');
        if (window.FitAddon) {
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log('FitAddon applied on window load');
            } catch (e) {
                console.error('FitAddon error on load:', e);
            }
        }
    });

    window.addEventListener('resize', () => {
        const { cols, rows } = calculateTerminalSize();
        term.resize(cols, rows);
        console.log('Terminal resized on window resize');
        if (window.FitAddon) {
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log('FitAddon applied on window resize');
            } catch (e) {
                console.error('FitAddon error on resize:', e);
            }
        }
    });

    // Verify onKey exists
    if (!term.onKey) {
        console.error('term.onKey is not a function. Available methods:', ObjectById(term));
        throw new Error('term.onKey is not a function');
    }

    let prompt = '';
    term.onKey(({ key, domEvent }) => {
        try {
            console.log(`Key pressed: ${domEvent.key}, Code: ${domEvent.code}`);

            if (domEvent.key === 'Enter') {
                domEvent.preventDefault();
                console.log('Enter key detected, processing prompt:', prompt);
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
                        prompt = '';
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        term.writeln('');
                        term.writeln('Error: Connection failed');
                        term.write('Aetherix ~$ ');
                        prompt = '';
                    });
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

    term.onFocus = () => {
        console.log('Terminal focused');
    };
} catch (error) {
    console.error('Terminal setup error:', error);
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
        terminalElement.innerHTML = 'Error: Failed to set up terminal: ' + error.message + '. Please refresh.';
    } else {
        document.body.innerHTML = 'Error: Failed to set up terminal: ' + error.message + '. Please refresh.';
    }
}

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
        scrollback: 1000,
        wrap: true  // Enable text wrapping
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
        const styles = getComputedStyle(terminalElement);
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const borderWidth = parseFloat(styles.borderWidth) || 2;  // Account for 2px border
        const containerWidth = terminalElement.clientWidth - paddingLeft - paddingRight - (borderWidth * 2);
        const containerHeight = terminalElement.clientHeight - paddingTop - paddingBottom - (borderWidth * 2);
        const cols = Math.max(1, Math.floor(containerWidth / charWidth));
        const rows = Math.max(1, Math.floor(containerHeight / charHeight));
        console.log(`Calculated terminal size: ${cols} cols, ${rows} rows (adjusted for padding and borders)`);
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

            // Try FitAddon as a fallback, but only if manual sizing fails
            if (window.FitAddon) {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);

                // Retry fitting to handle timing issues
                function fitWithRetry(attempts = 5, delay = 500) {
                    if (attempts <= 0) {
                        console.error('Failed to fit terminal after retries, sticking with calculated size');
                        return;
                    }
                    try {
                        fitAddon.fit();
                        const { cols: fittedCols, rows: fittedRows } = term;
                        if (fittedCols > 0 && fittedRows > 0) {
                            // Ensure fitted size doesn’t exceed container
                            const { cols: maxCols, rows: maxRows } = calculateTerminalSize();
                            if (fittedCols <= maxCols && fittedRows <= maxRows) {
                                console.log(`Terminal fitted: ${fittedCols} cols, ${fittedRows} rows`);
                                return;
                            } else {
                                console.warn('FitAddon size exceeds container, reverting to calculated size');
                                term.resize(maxCols, maxRows);
                                return;
                            }
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
    });

    window.addEventListener('resize', () => {
        const { cols, rows } = calculateTerminalSize();
        term.resize(cols, rows);
        console.log('Terminal resized on window resize');
    });

    // Verify onKey exists
    if (!term.onKey) {
        console.error('term.onKey is not a function. Available methods:', Object.keys(term));
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

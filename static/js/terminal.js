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

    // Initialize terminal
    function initializeTerminal() {
        try {
            console.log('Opening terminal...');
            term.open(terminalElement);
            console.log('Terminal opened successfully');

            // Try FitAddon if available
            if (window.FitAddon) {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);

                // Retry fitting to handle timing issues
                function fitWithRetry(attempts = 10, delay = 500) {
                    if (attempts <= 0) {
                        console.error('Failed to fit terminal after retries, using fallback size');
                        term.resize(80, 24);
                        return;
                    }
                    try {
                        fitAddon.fit();
                        const { cols, rows } = term;
                        if (cols > 0 && rows > 0) {
                            console.log(`Terminal fitted: ${cols} cols, ${rows} rows`);
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
                console.warn('FitAddon not loaded, using fixed size (80x24)');
                term.resize(80, 24);
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
        if (window.FitAddon) {
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log('Terminal resized on window load');
            } catch (e) {
                console.error('Resize error on load:', e);
            }
        }
    });

    window.addEventListener('resize', () => {
        if (window.FitAddon) {
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                fitAddon.fit();
                console.log('Terminal resized on window resize');
            } catch (e) {
                console.error('Resize error:', e);
            }
        }
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

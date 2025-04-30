try {
    // Check if xterm.js is loaded
    if (!window.Terminal) {
        console.error('xterm.js not loaded');
        document.getElementById('terminal').innerHTML = 'Error: Failed to load terminal library (xterm.js). Please refresh.';
        throw new Error('xterm.js not loaded');
    }

    console.log('xterm.js loaded successfully');

    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#000000',
            foreground: '#00ff00',
            cursor: '#00ff00'
        },
        cols: 80,  // Fixed size to avoid FitAddon issues
        rows: 24,
        scrollback: 1000
    });

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

    term.on('focus', () => {
        console.log('Terminal focused');
    });
} catch (error) {
    console.error('Terminal setup error:', error);
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
        terminalElement.innerHTML = 'Error: Failed to set up terminal: ' + error.message + '. Please refresh.';
    } else {
        document.body.innerHTML = 'Error: Failed to set up terminal: ' + error.message + '. Please refresh.';
    }
}

try {
    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#000000',
            foreground: '#00ff00',
            cursor: '#00ff00'
        },
        scrollback: 1000
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
        console.error('Terminal element not found');
        throw new Error('Terminal element not found');
    }
    term.open(terminalElement);

    // Function to fit terminal with retry
    function fitTerminalWithRetry(attempts = 5, delay = 100) {
        if (attempts <= 0) {
            console.error('Failed to fit terminal after retries');
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
        setTimeout(() => fitTerminalWithRetry(attempts - 1, delay), delay);
    }

    // Initial fit with retry
    fitTerminalWithRetry();

    // Resize on window resize
    window.addEventListener('resize', () => {
        try {
            fitAddon.fit();
            console.log('Terminal resized');
        } catch (e) {
            console.error('Resize error:', e);
        }
    });

    // Fallback: Force resize after DOM content loaded
    document.addEventListener('DOMContentLoaded', () => {
        fitTerminalWithRetry();
    });

    term.write('Aetherix ~$ ');

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

    term.focus();
} catch (error) {
    console.error('Terminal initialization error:', error);
}

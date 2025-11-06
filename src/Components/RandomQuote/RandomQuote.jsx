import React, { useState, useEffect, useCallback, useRef } from "react";
import './RandomQuote.css'


const THEQUOTESHUB_RANDOM = 'https://thequoteshub.com/api/random-quote';

// Small bundled fallback in case remote API is down / blocked by TLS/CORS
const LOCAL_FALLBACK_QUOTES = [
    { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
    { text: "Do not take life too seriously. You will never get out of it alive.", author: "Elbert Hubbard" },
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" },
    { text: "In the end, we will remember not the words of our enemies, but the silence of our friends.", author: "Martin Luther King Jr." },
];

const RandomQuote = () =>{
    const [quote, setQuote] = useState({
        text: "Yebela Biresa; Yabela Ayresam!",
        author: "Pikolu",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isFaded, setIsFaded] = useState(false);

    const fetchRandom = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(THEQUOTESHUB_RANDOM, { signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // theQuoteHub returns { text, author, ... }
            setQuote({ text: data.text, author: data.author });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('fetchRandom error', err);
                // fall back to local quotes when network/TLS/CORS fails
                setError(err.message || 'Failed to fetch quote — using local fallback');
                const fallback = LOCAL_FALLBACK_QUOTES[Math.floor(Math.random() * LOCAL_FALLBACK_QUOTES.length)];
                setQuote(fallback);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchRandom(controller.signal);
        return () => controller.abort();
    }, [fetchRandom]);

    const onReload = () => {
        // simple fade-out then fetch for smoother transition
        setIsFaded(true);
        setTimeout(() => {
            const controller = new AbortController();
            fetchRandom(controller.signal);
        }, 180);
    };

    const twitterShareUrl = quote?.text
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`"${quote.text}" ${quote.author || ''}`)}`
        : '#';

    const telegramShareUrl = quote?.text
        ? `https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(`"${quote.text}" ${quote.author || ''}`)}`
        : '#';

    const [shareNotice, setShareNotice] = useState(null);
    const [shareLoading, setShareLoading] = useState(false);

    const onInstagramShare = async () => {
        const text = `"${quote.text}" ${quote.author || ''}`;
        setShareLoading(true);
        setShareNotice(null);

        // 1) Try Web Share API (best on mobile)
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ text });
                setShareLoading(false);
                return;
            } catch (err) {
                // user cancelled or share failed — fall through to clipboard fallback
                console.debug('Web Share failed or cancelled', err);
            }
        }

        // 2) Try clipboard API
        let copied = false;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                copied = true;
            } else {
                // legacy fallback
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try { document.execCommand('copy'); copied = true; } catch (e) { copied = false; }
                document.body.removeChild(ta);
            }
        } catch (err) {
            console.warn('Clipboard write failed', err);
            copied = false;
        }

        if (copied) {
            setShareNotice('Quote copied to clipboard — open Instagram and paste it into a post.');
        } else {
            setShareNotice('Unable to copy quote automatically. Please select and copy this quote manually.');
        }

        // 3) Try to open the Instagram app via URL scheme (mobile). This may fail silently on desktop.
        try {
            // common Instagram URL schemes (may or may not work depending on platform)
            const schemeUrls = [
                'instagram://camera',
                'instagram://app',
                'instagram://',
            ];
            // open the first scheme; if it fails nothing happens in most browsers
            window.open(schemeUrls[0], '_blank');
        } catch (err) {
            // ignore
        }

        // As a final fallback open instagram.com in a new tab to nudge the user
        try { window.open('https://www.instagram.com/', '_blank', 'noopener'); } catch (e) {}

        setTimeout(() => { setShareNotice(null); setShareLoading(false); }, 4200);
    };

    // modal state for long quotes
    const [showModal, setShowModal] = useState(false);
    // detect long quote (approx by char count) to show 'Show more'
    const isLongQuote = quote?.text && quote.text.length > 240;

    // close modal on Escape
    useEffect(() => {
        if (!showModal) return;
        const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showModal]);

    // clear fade state shortly after triggering it so the new quote can fade in
    useEffect(() => {
        if (!isFaded) return;
        const t = setTimeout(() => setIsFaded(false), 420);
        return () => clearTimeout(t);
    }, [isFaded]);

    // sheen follow cursor: pointer tracking using CSS variables for performant updates
    const containerRef = useRef(null);
    const rafRef = useRef(null);
    const lastPos = useRef({ x: 30, y: 20 });

    const handlePointerMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? 0;
        const clientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? 0;
        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        lastPos.current = { x, y };
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            containerRef.current.style.setProperty('--mx', `${x}%`);
            containerRef.current.style.setProperty('--my', `${y}%`);
        });
    };

    const handlePointerLeave = () => {
        // softly reset to default center-ish position
        if (!containerRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            containerRef.current.style.setProperty('--mx', `30%`);
            containerRef.current.style.setProperty('--my', `20%`);
        });
    };

    useEffect(() => {
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, []);

    return(
        <>
        <div
            className="container"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            {loading ? (
                <div className="quote">Loading quote...</div>
            ) : error ? (
                <div className="quote">Error: {error}</div>
            ) : (
                <>
                    <div className={`quote ${isFaded ? 'faded' : ''}`}>{quote?.text}</div>
                    {isLongQuote && !showModal && (
                        <div style={{display:'flex', justifyContent:'center', marginTop:8}}>
                            <button className="show-more" onClick={() => setShowModal(true)} aria-expanded={showModal}>
                                Show more
                            </button>
                        </div>
                    )}
                    <div>
                        <div className="line"></div>
                        <div className="bottom">
                            <div className="author">{quote?.author || 'Unknown'}</div>
                            <div className="icons">
                                <button
                                    className="icon-button reload-btn"
                                    onClick={onReload}
                                    disabled={loading}
                                    aria-label="Load new random quote"
                                    title="New quote"
                                >
                                    {/* Inline SVG refresh icon */}
                                    <svg
                                        className={`reload-icon icon-svg ${loading ? 'spin' : ''}`}
                                        viewBox="0 0 24 24"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                    >
                                        <path fill="none" d="M0 0h24v24H0z" />
                                        <path fill="currentColor" d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5 0 1.03-.31 1.99-.84 2.8l1.46 1.46C18.73 15.36 19 14.21 19 13c0-3.87-3.13-7-7-7zM6.34 6.34L4.93 7.75C5.67 9.02 6 10.46 6 12c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5 0-1.54.33-2.98 1-4.25z" />
                                    </svg>
                                </button>
                                <a href={twitterShareUrl} target="_blank" rel="noreferrer" className="twitter-link icon-button" aria-label="Share on Twitter">
                                    {/* Inline Twitter SVG */}
                                    <svg className="icon-svg twitter-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path fill="currentColor" d="M22.46 6c-.77.35-1.6.58-2.46.69a4.26 4.26 0 0 0 1.88-2.36 8.53 8.53 0 0 1-2.7 1.03 4.24 4.24 0 0 0-7.22 3.86A12.04 12.04 0 0 1 3.15 4.6a4.24 4.24 0 0 0 1.31 5.66 4.2 4.2 0 0 1-1.92-.53v.05c0 2.02 1.44 3.71 3.35 4.09a4.27 4.27 0 0 1-1.91.07c.54 1.69 2.1 2.92 3.95 2.96A8.51 8.51 0 0 1 2 19.54a12.02 12.02 0 0 0 6.52 1.91c7.83 0 12.11-6.48 12.11-12.1v-.55A8.6 8.6 0 0 0 24 5.5a8.36 8.36 0 0 1-2.54.7z" />
                                    </svg>
                                </a>
                                <a href={telegramShareUrl} target="_blank" rel="noreferrer" className="icon-button" aria-label="Share on Telegram" title="Share on Telegram">
                                    <svg className="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path fill="currentColor" d="M21.5 3.5L2.5 10.5c-.6.2-.6.9 0 1.1l4.1 1.6 1.6 5.3c.2.6.9.8 1.3.4l2.2-2 3.7 2.7c.6.4 1.3.1 1.5-.7L22 4.9c.1-.6-.5-1-1-.7zM10.4 15.6l-.8-2.8 8-5.1-7.2 7.9z" />
                                    </svg>
                                </a>
                                <button className="icon-button" onClick={onInstagramShare} aria-label="Share on Instagram" title="Share on Instagram">
                                    <svg className="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm8 2H9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zM12 9.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm4.8-3.3a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z" />
                                    </svg>
                                </button>
                                {shareNotice && <div className="share-notice">{shareNotice}</div>}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
        {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                    <div className="modal-quote">{quote?.text}</div>
                    <div className="modal-author">{quote?.author || 'Unknown'}</div>
                    <button className="modal-close" onClick={() => setShowModal(false)}>Close</button>
                </div>
            </div>
        )}
        </>
    )
}

export default RandomQuote
// Note: Modal markup is inserted inside the component render for simplicity.
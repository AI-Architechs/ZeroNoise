# ZeroNoise

**A privacy-first content filter that learns from your actions.**

ZeroNoise is a Chrome extension that helps you filter social media noise. Unlike keyword blockers, it learns from what YOU hide and filters similar content automatically. Everything runs locally in your browser—no servers, no tracking.

---

## ✨ Features

- 🧠 **Learn from your actions** - Hide posts you don't want, extension learns patterns automatically
- 🏷️ **Category tagging** - Tag posts (gossip, politics, sports, etc.) for better filtering
- 🔒 **100% private** - All processing happens locally, no data sent anywhere
- 👁️ **Transparent** - See exactly why posts are filtered with detailed explanations
- ↩️ **Reversible** - Undo any action, mark content to always show
- 📦 **Backup/Restore** - Export and import your learned patterns
- 🌙 **Dark mode** - Automatic light/dark theme support

---

## 🚀 Supported Platforms

- ✅ Reddit
- ✅ X / Twitter
- ✅ YouTube

---

## 📦 Installation

1. Download or clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the extension folder

---

## 🎯 How to Use

### Quick Start

1. **Browse normally** - Nothing is filtered initially
2. **Hide posts you don't want** - Hover over a post → "Hide more like this"
3. **Choose a category** (optional) - Gossip, Politics, Sports, or create custom
4. **Let it learn** - Similar content gets filtered automatically

### Filter States

- **Show** - Normal post (no filter)
- **Blur** - Soft filter (post is blurred, still visible)
- **Hide** - Strong filter (post minimized to small bar)

### Understanding Filtering

Click **"Why?"** on any post to see:
- Hide score vs Show score
- Matched categories
- Specific signals that triggered filtering
- Detected names and phrases

Example:
```
Hide score: 4.5 (threshold: 2.2/4.2)
Categories: Gossip & Drama
Matched signals: gossip-style language • name you hid: Taylor Swift
```

### Undo & Override

- **Undo** - Reverse your last action
- **Always show this** - Mark content to never filter

---

## ⚙️ Settings

### Filter Thresholds
- **Soft threshold** (default: 2.2) - When to blur
- **Hard threshold** (default: 4.2) - When to hide

Lower = more aggressive, Higher = more permissive

### Custom Tags
Create custom categories for any topic (e.g., "crypto", "standup", "celebrity news")

### Backup & Restore
- Export your learned patterns to JSON
- Import patterns from backups or other devices
- Choose merge strategy (Average or Keep Higher)

### View Patterns
See all learned patterns (phrases, names, domains, styles) and remove individual ones

---

## 🧠 What It Learns

From each post you hide:
- **Phrases** - Key 2-word combinations
- **Names** - People or topics mentioned
- **Sources** - Website domains
- **Writing Styles** - ALL CAPS, multiple exclamation marks!!!
- **Category** - Your tag (gossip, politics, etc.)

---

## 🔐 Privacy

### What ZeroNoise Does NOT Do
- ❌ Send data to servers
- ❌ Track your browsing
- ❌ Use analytics or telemetry
- ❌ Require an account

### What It Does
- ✅ Processes everything locally
- ✅ Stores data in Chrome's local storage only
- ✅ Open source - verify it yourself

**You can check:** Network tab shows zero external requests.

---

## 💡 Tips

**For best results:**
- Hide 10-20 posts in your first session
- Tag posts accurately by category
- Use custom categories for specific topics
- Check the "Why?" panel to understand what it's learning
- Export your patterns monthly as backup

**Training timeline:**
- Day 1-2: Hide posts, tag by category
- Day 3+: See automatic filtering
- Week 2+: Fine-tune with undo/always show

---

## 🐛 Troubleshooting

**Nothing is being filtered**
- Hide more posts to train it
- Check extension is enabled in popup

**Too much is filtered**
- Increase thresholds in Settings
- Use "Always show this" on false positives

**Extension not working**
- Only works on Reddit, X/Twitter, YouTube
- Try refreshing the page

---

## 🎯 Philosophy

**ZeroNoise is YOUR filter, not ours.**

We don't decide what's noise. You do.

- Start with a blank slate
- Train it with your preferences
- Optional category templates available
- Complete transparency on filtering decisions

**This is not a filter bubble tool** - Disagreement ≠ Noise. Only you decide what's noise for your feed.

---

## 📜 License

MIT License - Use freely, modify as you wish.

---

## 🤝 Contributing

Open source and contributions welcome!

**Ideas:** More platforms, better detection, keyboard shortcuts, pattern sharing (opt-in)

---

**Enjoy a calmer feed. 🌿**

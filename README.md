# Dictionario

A playful terminal dictionary and word picker built for curious minds, fast writing, and vocabulary discovery.

Dictionario helps you search from a huge English word list, quickly narrow your results with smart filters, and copy your chosen word straight to the clipboard. Every word you select gets remembered so it stays out of future suggestions—perfect for learning new vocabulary without repeating the same picks.

Created by Francis Enrico Ramos

## ✨ Features

- Interactive terminal search with instant suggestions
- Prefix and suffix filtering using patterns like `a-y`
- Length-based filtering with `/length 5`
- Clipboard support for Windows, macOS, and Linux
- Persistent word history saved in `words.txt`
- Clean, keyboard-first experience optimized for terminal users

## 🚀 Getting Started

Install dependencies:

```bash
bun install
```

Run the app:

```bash
bun run index.ts
```

## 🎮 How to Use

- Type to search for words by beginning
- Use the up and down arrow keys to move through matches
- Press `Enter` to copy the highlighted word to your clipboard
- Use `/length 5` to show only words longer than 5 characters
- Use `/length off` to clear the filter
- Use patterns like `a-y` to match words that begin with `a` and end with `y`
- Type `/exit` to quit the app

## 🧠 Example

```text
what word do you wanted to search > a-y
```

This will show words that start with `a` and end with `y`, helping you explore vocabulary in a very natural, intuitive way.

## 📁 Project Files

- `index.ts` – main interactive app logic
- `words.txt` – saved words that have already been used
- `package.json` – project metadata and scripts

## 🌟 Notes

Dictionario pulls from a large built-in English word list, so you can begin exploring without manually entering vocabulary. If you want a word to reappear in suggestions later, simply remove it from `words.txt`.

## 🏷️ Project Identity

Project name: Dictionario

Created by Francis Enrico Ramos

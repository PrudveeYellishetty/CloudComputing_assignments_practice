# NPTEL Practice Arena

A lightweight static quiz app for practicing assignment questions in a mock NPTEL / SWAYAM-style interface.

## Features
- Random 10-question test from a JSON question bank
- No repeated questions within the same test
- Asked-count tracking to reduce repeated questions across sessions
- Immediate answer reveal or end-of-test reveal
- Wrong-answer report with a dedicated retest
- Pure Python + static HTML/CSS/JS, no Node or npm

## Run
From this folder, start the Python server:

```bash
python server.py
```

Then open:

```text
http://127.0.0.1:8000
```

## Question bank format
Edit `static/data/qbank.json` with your own questions.

Each item should look like this:

```json
{
  "id": 1,
  "question": "Your question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer_index": 1,
  "explanation": "Optional explanation",
  "marks": 1,
  "asked_count": 0
}
```

## Notes
- `asked_count` is updated automatically by the Python server when a test starts.
- If you want more or fewer than 10 questions, change the value in the settings panel before starting the test.

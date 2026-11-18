# Tomato

Tomato is a minimalist, data-oriented Pomodoro timer web application built with React, TypeScript, Vite, and Tailwind CSS, inspired by Material 3 Expressive design.

## Features

- **Pomodoro Timer**: Focus, Short Break, and Long Break intervals with circular progress (smooth ring for Focus, wavy animated ring for Breaks), session counter, Infinite Focus mode, reset with Undo, and Skip Next.
- **Topics**: Create, edit, and switch between custom topics with their own focus/break durations, session length, autostart behavior, Material 3 Expressive shapes, and dynamic seed colors.
- **Statistics**: Track focus and break time automatically in `localStorage`. View Today's summary, Last Week / Last Month column charts, Last Year line chart, Lifetime total, and drill-down views with time-of-day (Morning, Afternoon, Evening, Night) and per-topic breakdowns.
- **Appearance & Settings**: System/Light/Dark themes, pure black AMOLED mode, 11 dynamic color schemes, Always-On Display (AOD) mode, daily focus goal line, Web Audio alarm chime with vibration, JSON backup/restore, and data reset.

## Development

```bash
npm install
npm run dev
```

The dev server runs on `http://0.0.0.0:3000`.

## Build

```bash
npm run build
```

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

# Capture Open

**Capture Open** is a high-performance, professional photo review and culling application designed for photographers who need speed and reliability. Built with a modern hybrid architecture, it combines the power of a desktop application with the flexibility of web technologies.

## 🚀 Key Features

-   **⚡ Cache-First Performance**: Instant image loading powered by a local SQLite database. No more waiting for thumbnails to regenerate.
-   **🔄 Smart Background Sync**: Automatically detects file additions, deletions, and modifications in real-time without blocking the UI.
-   **🖼️ Progressive & Lazy Loading**: Smooth scrolling through thousands of images with optimized rendering and blurred placeholders.
-   **🎨 Modern Dark UI**: A distraction-free, professional interface featuring glassmorphism and fluid animations.
-   **🔌 Hybrid Architecture**: (In Development) Acts as a local server to allow remote review from iPads or other devices on the local network.

## 🛠️ Tech Stack

-   **Core**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
-   **Performance**:
    -   `better-sqlite3` for metadata caching
    -   `sharp` for high-speed image processing
    -   `chokidar` for file system watching

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/manhtuanphoto/capture_open.git
    cd capture_open
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run in Development Mode**
    ```bash
    npm run electron:dev
    ```

4.  **Build for Production**
    ```bash
    npm run build
    ```

## 🗺️ Roadmap

-   [x] Project & Folder Management
-   [x] High-Performance Image Grid
-   [x] Cache-First Architecture
-   [ ] Remote Review Client (Web)
-   [ ] AI-Assisted Culling & Editing
-   [ ] Metadata Editing (XMP Sidecar support)

## 📄 License

MIT License.

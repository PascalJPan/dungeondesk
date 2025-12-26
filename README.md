# Dungeon Desk

A powerful campaign management tool for tabletop RPG Game Masters. Organize your world-building, track entities, manage combat, and export content for AI-assisted creation.

It is online and ready to use here: https://pascalpan.com/creations/DungeonDesk/
(Your progess is only cached so better download the campaign json via export after each session ;))

## ✨ Features

### 📚 Entity Management
- **Configurable Entity Types**: Locations, Characters, Monsters, Items, Happenings, and custom types
- **Rich Attributes**: Each entity type has customizable attributes (descriptions, stats, relationships)
- **Copy & Duplicate**: Easily copy entity types as templates for new configurations
- **Color-Coded Organization**: Visual distinction between entity types

### 🗺️ Multiple Views
- **List View**: Traditional list with filtering and search
- **Node Graph**: Visual relationship mapping with React Flow
- **Table View**: Spreadsheet-style data overview
- **Combat Tracker**: Initiative tracking and combat management

### 🤖 AI Integration
- **PDF/Text Extraction**: Upload PDFs or paste text for AI-powered entity extraction
- **OpenAI Integration**: Uses GPT for intelligent entity parsing
- **Copy as Prompt**: Export your schema for use with external AI tools (ChatGPT, Claude)
- **Configurable Extraction**: Set inference levels, tone, and language preferences

### ⚔️ Combat Tracker
- **Initiative Management**: Roll and track initiative order
- **Health Tracking**: Monitor HP for all combatants
- **Combat Actions**: Attack rolls, damage application
- **Round Counter**: Keep track of combat progression

### 💾 Data Management
- **JSON Import/Export**: Full campaign data portability
- **Markdown Export**: Generate formatted documentation
- **Local Storage**: Automatic save to browser storage
- **Merge Options**: Flexible import with keep/merge settings

### ❓ Questions Panel
- **Empty Field Detection**: Find missing information across entities
- **Quick Navigation**: Jump to entities needing attention
- **Review Status**: Track approved vs. needs-review entities

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project directory
cd dungeon-desk

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. **Configure Entity Types** (Settings tab)
   - Customize entity types and their attributes
   - Set extraction prompts for AI guidance
   - Mark types as combat-eligible

2. **Add Entities**
   - Manual: Click "+ Location", "+ Character", etc.
   - AI Extraction: Upload PDF or paste text in Extract tab
   - Import: Load existing JSON campaign data

3. **Organize & View**
   - Switch between List, Nodes, Table, and Combat views
   - Use filters to find specific entities
   - Click entities to view/edit details

4. **Export**
   - JSON for backup/sharing
   - Markdown for documentation
   - Copy as Prompt for external AI tools

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Graph Visualization**: React Flow
- **PDF Processing**: pdfjs-dist
- **State Management**: React hooks + localStorage

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── CombatTracker.tsx
│   ├── EntityList.tsx
│   ├── EntityPanel.tsx
│   ├── InputPanel.tsx
│   ├── NodeGraph.tsx
│   ├── QuestionsPanel.tsx
│   └── TableView.tsx
├── hooks/
│   └── use-campaign-storage.ts
├── pages/
│   └── Index.tsx        # Main application page
├── types/
│   └── mindmap.ts       # Type definitions
└── lib/
    └── utils.ts
```

## 🎨 Design

Dungeon Desk features a dark, parchment-inspired aesthetic perfect for fantasy campaign management:
- Ink texture backgrounds
- Serif typography for an aged document feel
- Color-coded entity types for quick identification
- Responsive design for desktop and tablet use

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for Game Masters everywhere

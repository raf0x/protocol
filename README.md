# 🧬 Protocol

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-green)

### A modern health protocol manager designed for people serious about optimizing their health.

**🌐 Live Demo:** https://www.mypepprotocol.app/

</div>

---

# Overview

**Protocol** is an all-in-one health management platform built to simplify complex wellness routines.

Whether you're managing prescriptions, supplements, peptides, hormone replacement therapy (TRT), vitamins, or performance-enhancing protocols, Protocol gives you a single place to organize everything with clarity.

Instead of juggling spreadsheets, reminder apps, and scattered notes, Protocol helps users build structured protocols, monitor adherence, and understand exactly what they're taking—and why.

---

# Why I Built It

As someone deeply interested in longevity, preventive medicine, and health optimization, I struggled to find software that actually fit the way enthusiasts manage their protocols.

Most medication apps are designed for traditional prescriptions.

Protocol was built for people whose routines are more dynamic:

- TRT
- Peptides
- Supplements
- Vitamins
- Hormone optimization
- Preventative health
- Performance protocols

The goal wasn't simply to remind users to take something—it was to create an organized health operating system that makes complex routines feel effortless.

---

# Features

### 💊 Comprehensive Protocol Management

Create and manage personalized health protocols with support for medications, supplements, peptides, hormones, and more.

---

### 📅 Daily Schedule

View everything you need to take each day in one clean timeline.

No more switching between multiple reminder apps.

---

### 🧪 Health Optimization Focus

Designed specifically for modern wellness routines, including:

- TRT
- HCG
- GLP-1 medications
- Peptides
- Vitamins
- Nutraceuticals
- Lifestyle protocols

---

### 📋 Organized Inventory

Keep track of compounds, dosages, frequencies, and schedules in one centralized dashboard.

---

### 📱 Responsive Experience

Optimized for desktop, tablet, and mobile devices.

Manage your protocol wherever you are.

---

### 🎨 Modern User Interface

Built with simplicity in mind:

- Clean layouts
- Minimal distractions
- Fast navigation
- Accessible design
- Mobile-first experience

---

# Screenshots

> Replace these placeholders with actual screenshots.

| Dashboard | Today's Protocol |
|------------|------------------|
| ![](docs/dashboard.png) | ![](docs/today.png) |

| Protocol Builder | Mobile |
|------------------|--------|
| ![](docs/protocol-builder.png) | ![](docs/mobile.png) |

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript

## Styling

- Tailwind CSS
- shadcn/ui

## Backend

- Supabase
- PostgreSQL
- Authentication
- Row-Level Security (RLS)

## Forms & Validation

- React Hook Form
- Zod

## Deployment

- Vercel

---

# Architecture

```
                User
                  │
                  ▼
          Next.js Application
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
 Protocol Engine     Authentication
        │                   │
        └─────────┬─────────┘
                  ▼
             Supabase
                  │
                  ▼
           PostgreSQL Database
```

---

# Project Structure

```
src/
│
├── app/
├── components/
├── hooks/
├── lib/
├── services/
├── types/
├── utils/
└── styles/
```

---

# Design Philosophy

Health management software often falls into one of two categories:

- Clinical software built for hospitals
- Basic reminder apps with little flexibility

Protocol aims to bridge that gap by combining the simplicity of consumer applications with the flexibility required by people managing sophisticated health routines.

The focus is on clarity, organization, and reducing the mental overhead of maintaining long-term protocols.

---

# Engineering Challenges

Building Protocol presented several interesting technical challenges:

### Complex Scheduling

Supporting daily, weekly, monthly, and custom recurring schedules while keeping the interface intuitive.

---

### Flexible Data Modeling

Designing a system capable of supporting virtually any health protocol without restricting users to predefined medication types.

---

### Secure Personal Data

Health information is sensitive.

Protocol uses authentication and database-level security to ensure users only have access to their own data.

---

### User Experience

Managing dozens of medications and supplements can quickly become overwhelming.

The interface was carefully designed to make even complex protocols feel simple to navigate.

---

# Local Development

Clone the repository

```bash
git clone https://github.com/raf0x/protocol.git
```

Install dependencies

```bash
npm install
```

Start the development server

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

# Roadmap

Future improvements include:

- 📊 Biomarker tracking
- 🩸 Blood test history
- 📈 Progress analytics
- 🤖 AI-powered protocol recommendations
- 📄 PDF protocol exports
- 🔔 Smart medication reminders
- 📷 Barcode medication scanner
- 🏥 Physician collaboration
- 📱 Progressive Web App
- ⌚ Apple Health & wearable integrations

---

# Lessons Learned

This project strengthened my experience in:

- Next.js App Router
- TypeScript
- Full-stack application architecture
- Authentication flows
- PostgreSQL data modeling
- Responsive interface design
- Component architecture
- Building software around real-world user workflows

---

# Contributing

Contributions, feature requests, and feedback are always welcome.

To contribute:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a Pull Request

---

# Disclaimer

Protocol is designed as an organizational tool and **is not intended to provide medical advice, diagnosis, or treatment**.

Users should always consult qualified healthcare professionals before making changes to medications, supplements, or treatment plans.

---

# License

Released under the MIT License.

---

# Author

**Rafael Lemor**

Frontend Developer • Product Designer • Health Technology Enthusiast

If you found this project useful or interesting, consider giving it a ⭐ on GitHub.

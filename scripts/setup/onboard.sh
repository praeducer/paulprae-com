#!/bin/bash
# Onboarding script for new developers
# Sets up the development environment and runs initial checks

set -e

echo "🚀 Onboarding paulprae-com..."
echo

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -d "scripts" ]]; then
  echo "❌ Error: Run this script from the project root directory"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo
echo "🔧 Setting up Git hooks..."
npm run prepare

echo
echo "📊 Running data pipeline..."
echo "   (Skipping pipeline - run 'npm run pipeline' manually if needed)"
# npm run pipeline

echo
echo "🧪 Running tests..."
npm test

echo
echo "🏗️ Building project..."
npm run build

echo
echo "✅ Running final checks..."
npm run check

echo
echo "🎉 Onboarding complete!"
echo
echo "Next steps:"
echo "  npm run dev          # Start development server"
echo "  npm run pipeline     # Update resume/data when needed"
echo "  npm run check        # Run pre-push checks"
echo
echo "Happy coding! 🚀"
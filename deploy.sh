#!/bin/bash
# Deployment script for your hosting provider

set -e

echo "=== Starting Deployment ==="

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Build the application
echo "Building the application..."
npm run build

# Run database migrations (make sure DATABASE_URL is set)
echo "Setting up database..."
npm run db:push

echo "=== Deployment Complete ==="
echo "Start the app with: npm start"

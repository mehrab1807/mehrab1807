#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "========================================================"
echo "  Rukn - Private Journal"
echo "========================================================"
echo ""
echo "Serving directory: $(pwd)"
echo "Opening http://localhost:8000..."
echo ""

# Open default browser
if command -v open >/dev/null 2>&1; then
  open "http://localhost:8000"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:8000"
fi

# Run python server
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  python -m http.server 8000
else
  echo "Error: Python 3 is required to run the local server."
  read -p "Press enter to exit..."
fi

#!/bin/bash

echo "Triggering Carzone scraping..."
curl -X POST http://localhost:8000/api/admin/refresh \
  -H "Content-Type: application/json" \
  -d '{"source":"carzone"}'
echo ""

echo ""
echo "Waiting 5 seconds before triggering CarsIreland..."
sleep 5

echo "Triggering CarsIreland scraping..."
curl -X POST http://localhost:8000/api/admin/refresh \
  -H "Content-Type: application/json" \
  -d '{"source":"carsireland"}'
echo ""

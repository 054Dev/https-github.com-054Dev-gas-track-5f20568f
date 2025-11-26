-- Add cylinder_capacities data for customer orders
INSERT INTO cylinder_capacities (capacity_kg) VALUES (3), (6), (13) ON CONFLICT DO NOTHING;
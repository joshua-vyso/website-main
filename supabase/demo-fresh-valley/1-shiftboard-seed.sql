-- Seed ShiftBoard for the Fresh Valley Produce demo org (Cape Town fruit & veg
-- wholesale, ~R7M/month, 40 staff). Re-runnable: each table is delete-for-org
-- then insert, scoped to the org by name. All money in ZAR.
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run.
-- Coherent with SPEC.departments / SPEC.employees / SPEC.devices.

-- ===========================================================================
-- 1. Departments (7 from SPEC, hex colours from DEPARTMENT_COLOR conventions)
-- ===========================================================================
delete from sb_departments where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into sb_departments (org_id, name, required, color)
select o.id, v.name, v.required, v.color
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Cold Store', 8, '#0C447C'),
  ('Dispatch',   6, '#D9730D'),
  ('Drivers',    7, '#2C7A8A'),
  ('Receiving',  5, '#0F6E56'),
  ('Packing',    6, '#854F0B'),
  ('Sales',      5, '#5B53C0'),
  ('Admin',      3, '#5F6368')
) as v(name, required, color);

-- ===========================================================================
-- 2. Employees (all 40 from SPEC.employees). skills jsonb keyed by SKILL_NAMES
--    [Receiving, Dispatch, Prep Kitchen, Driving, Customer Service,
--     Stock Handling, Device Operation]. Live-ops device columns populated for
--    Working staff in Packing/Receiving/Cold Store (links to SPEC.devices).
-- ===========================================================================
delete from sb_employees where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into sb_employees (
  org_id, name, role, department, status, next_shift, shift_time,
  hours_this_week, contracted_hours, rate, attendance_score, leave_balance,
  skills, available_days, unavailable_days, preferred_shifts, devices,
  current_department, current_task, current_recipe, assigned_device
)
select o.id, v.name, v.role, v.department, v.status, v.next_shift, v.shift_time,
       v.hours_this_week, v.contracted_hours, v.rate, v.attendance_score, v.leave_balance,
       v.skills::jsonb, v.available_days::jsonb, v.unavailable_days::jsonb, v.preferred_shifts, v.devices::jsonb,
       v.current_department, v.current_task, v.current_recipe, v.assigned_device
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  -- COLD STORE (8) ---------------------------------------------------------
  ('Themba Zulu','Warehouse lead','Cold Store','Working','Tomorrow 07:00','07:00–15:00',43,45,72,95,9,
    '{"Receiving":3,"Dispatch":3,"Prep Kitchen":0,"Driving":1,"Customer Service":2,"Stock Handling":5,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Days','[]',
    'Cold Store','Cold store supervision',null,null),
  ('Bongani Sithole','Warehouse assistant','Cold Store','Working','Tomorrow 07:00','07:00–15:00',41,45,46,96,11,
    '{"Receiving":3,"Dispatch":2,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":5,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Cold Store','Putaway & rotation',null,null),
  ('Sibusiso Ndlovu','Cold store operator','Cold Store','Working','Tomorrow 07:00','07:00–15:00',44,45,48,91,7,
    '{"Receiving":3,"Dispatch":2,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":5,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','["Floor Scale 2"]',
    'Cold Store','Cold room weigh-in',null,'Floor Scale 2'),
  ('Pieter Botha','Forklift operator','Cold Store','Working','Tomorrow 07:00','07:00–15:00',45,45,55,89,6,
    '{"Receiving":2,"Dispatch":3,"Prep Kitchen":0,"Driving":3,"Customer Service":1,"Stock Handling":5,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Cold Store','Pallet movement',null,null),
  ('Lwazi Dube','Stock controller','Cold Store','Working','Tomorrow 07:00','07:00–15:00',42,45,52,93,8,
    '{"Receiving":4,"Dispatch":3,"Prep Kitchen":0,"Driving":1,"Customer Service":2,"Stock Handling":5,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Days','["Floor Scale 2"]',
    'Cold Store','Stock count & control',null,null),
  ('Karabo Molefe','Warehouse assistant','Cold Store','Off','Tomorrow 07:00','07:00–15:00',38,45,45,90,10,
    '{"Receiving":3,"Dispatch":2,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":4,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    null,null,null,null),
  ('Ahmed Patel','Inventory clerk','Cold Store','Working','Tomorrow 07:00','07:00–15:00',38,40,50,97,12,
    '{"Receiving":4,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":2,"Stock Handling":4,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','["Floor Scale 2"]',
    'Cold Store','Inventory reconciliation',null,'Floor Scale 2'),
  ('Johan Smit','Cold store operator','Cold Store','Working','Tomorrow 07:00','07:00–15:00',44,45,48,87,5,
    '{"Receiving":3,"Dispatch":2,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":4,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','[]',
    'Cold Store','Cold room loading',null,null),
  -- DISPATCH (6) -----------------------------------------------------------
  ('Kabelo Nkosi','Dispatch lead','Dispatch','Working','Tomorrow 08:00','08:00–16:00',44,45,65,95,6,
    '{"Receiving":3,"Dispatch":5,"Prep Kitchen":0,"Driving":2,"Customer Service":3,"Stock Handling":4,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Days','["Pallet Scale 1"]',
    'Dispatch','Dispatch coordination',null,null),
  ('Riaan van Wyk','Dispatch clerk','Dispatch','Working','Tomorrow 09:00','09:00–17:00',37,40,50,85,5,
    '{"Receiving":3,"Dispatch":4,"Prep Kitchen":0,"Driving":2,"Customer Service":2,"Stock Handling":3,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Dispatch','Load planning',null,null),
  ('Nomsa Dlamini','Dispatch coordinator','Dispatch','Working','Tomorrow 08:00','08:00–16:00',39,40,54,94,8,
    '{"Receiving":3,"Dispatch":5,"Prep Kitchen":0,"Driving":1,"Customer Service":3,"Stock Handling":3,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Dispatch','Route sequencing',null,null),
  ('Tshepo Mahlangu','Order picker','Dispatch','Working','Tomorrow 08:00','08:00–16:00',43,45,44,88,4,
    '{"Receiving":3,"Dispatch":4,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":4,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Days','["Pallet Scale 1"]',
    'Dispatch','Order picking',null,null),
  ('Yusuf Cassiem','Order picker','Dispatch','On leave','7 Jul 08:00','08:00–16:00',0,45,44,86,3,
    '{"Receiving":3,"Dispatch":4,"Prep Kitchen":0,"Driving":1,"Customer Service":1,"Stock Handling":4,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    null,null,null,null),
  ('Lerato Pillay','Dispatch clerk','Dispatch','Working','Tomorrow 09:00','09:00–17:00',38,40,50,92,7,
    '{"Receiving":3,"Dispatch":4,"Prep Kitchen":0,"Driving":1,"Customer Service":2,"Stock Handling":3,"Device Operation":2}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Dispatch','Dispatch documentation',null,null),
  -- DRIVERS (7) ------------------------------------------------------------
  ('David Maluleke','Senior driver','Drivers','Working','Tomorrow 06:00','06:00–14:00',42,45,58,91,5,
    '{"Receiving":2,"Dispatch":3,"Prep Kitchen":0,"Driving":5,"Customer Service":3,"Stock Handling":3,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','[]',
    'Drivers','Delivery — Northern suburbs',null,null),
  ('Fanie Pretorius','Driver','Drivers','Absent','Tomorrow 06:00','06:00–14:00',12,45,53,72,4,
    '{"Receiving":2,"Dispatch":2,"Prep Kitchen":0,"Driving":4,"Customer Service":2,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Early','[]',
    null,null,null,null),
  ('Johan Botha','Driver','Drivers','On leave','2 Jul 06:00','06:00–14:00',0,45,53,87,3,
    '{"Receiving":2,"Dispatch":2,"Prep Kitchen":0,"Driving":5,"Customer Service":2,"Stock Handling":3,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Early','[]',
    null,null,null,null),
  ('Sipho Khumalo','Driver','Drivers','Working','Tomorrow 06:00','06:00–14:00',44,45,52,90,6,
    '{"Receiving":2,"Dispatch":3,"Prep Kitchen":0,"Driving":5,"Customer Service":2,"Stock Handling":3,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','[]',
    'Drivers','Delivery — Southern suburbs',null,null),
  ('Andre Williams','Driver','Drivers','Working','Tomorrow 06:00','06:00–14:00',43,45,54,89,5,
    '{"Receiving":2,"Dispatch":3,"Prep Kitchen":0,"Driving":5,"Customer Service":3,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Early','[]',
    'Drivers','Delivery — CBD route',null,null),
  ('Mandla Khoza','Driver','Drivers','Working','Tomorrow 06:00','06:00–14:00',47,45,52,84,4,
    '{"Receiving":2,"Dispatch":2,"Prep Kitchen":0,"Driving":4,"Customer Service":2,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','[]',
    'Drivers','Delivery — West Coast',null,null),
  ('Gift Mthembu','Driver-assistant','Drivers','Working','Tomorrow 06:00','06:00–14:00',41,45,42,93,7,
    '{"Receiving":2,"Dispatch":3,"Prep Kitchen":0,"Driving":2,"Customer Service":2,"Stock Handling":3,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Early','[]',
    'Drivers','Loading & deliveries',null,null),
  -- RECEIVING (5) ----------------------------------------------------------
  ('Aisha Patel','Receiving lead','Receiving','Working','Tomorrow 07:00','07:00–15:00',39,40,60,90,7,
    '{"Receiving":5,"Dispatch":2,"Prep Kitchen":0,"Driving":1,"Customer Service":2,"Stock Handling":4,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Early mornings','["Floor Scale 1"]',
    'Receiving','Goods-in check',null,'Floor Scale 1'),
  ('Naledi Mahlangu','Receiving clerk','Receiving','Working','Tomorrow 07:00','07:00–15:00',38,40,46,97,10,
    '{"Receiving":4,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":2,"Stock Handling":4,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Mornings','["Barcode Station 1"]',
    'Receiving','Barcode scanning',null,'Barcode Station 1'),
  ('Wandile Zwane','Receiving clerk','Receiving','Working','Tomorrow 07:00','07:00–15:00',37,40,46,89,8,
    '{"Receiving":4,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":1,"Stock Handling":4,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Mornings','["Floor Scale 1"]',
    'Receiving','Pallet weigh-in',null,'Floor Scale 1'),
  ('Chris Adams','Quality checker','Receiving','Working','Tomorrow 07:00','07:00–15:00',38,40,52,94,9,
    '{"Receiving":5,"Dispatch":1,"Prep Kitchen":1,"Driving":0,"Customer Service":2,"Stock Handling":3,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Mornings','[]',
    'Receiving','Quality inspection',null,null),
  ('Thabo Mokoena','Receiving assistant','Receiving','Scheduled','Today 11:00','11:00–17:00',30,40,44,91,9,
    '{"Receiving":3,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":3}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','["Barcode Station 1"]',
    null,null,null,null),
  -- PACKING (6) ------------------------------------------------------------
  ('Thandi Mokoena','Packing lead','Packing','Working','Tomorrow 08:00','08:00–16:00',44,45,64,96,8,
    '{"Receiving":2,"Dispatch":2,"Prep Kitchen":3,"Driving":0,"Customer Service":2,"Stock Handling":3,"Device Operation":5}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Bench Scale 1"]',
    'Packing','Packing line supervision',null,'Bench Scale 1'),
  ('Zanele Cele','Packer','Packing','Working','Tomorrow 08:00','08:00–16:00',43,45,42,92,6,
    '{"Receiving":2,"Dispatch":1,"Prep Kitchen":2,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Bench Scale 1"]',
    'Packing','Mixed Veg pack',null,'Bench Scale 1'),
  ('Precious Ngwenya','Packer','Packing','Working','Tomorrow 08:00','08:00–16:00',43,45,42,90,5,
    '{"Receiving":2,"Dispatch":1,"Prep Kitchen":2,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Bench Scale 2"]',
    'Packing','Stir-Fry Mix pack',null,'Bench Scale 2'),
  ('Ridwaan Isaacs','Packing operator','Packing','Working','Tomorrow 08:00','08:00–16:00',46,45,46,88,4,
    '{"Receiving":2,"Dispatch":1,"Prep Kitchen":3,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":5}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Camera Station 1"]',
    'Packing','Punnet labelling',null,'Camera Station 1'),
  ('Lindiwe Sibiya','Packer','Packing','On break','Tomorrow 08:00','08:00–16:00',42,45,42,93,7,
    '{"Receiving":2,"Dispatch":1,"Prep Kitchen":2,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":4}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Bench Scale 2"]',
    'Packing','Salad mix pack',null,'Bench Scale 2'),
  ('Katlego Tau','Packing operator','Packing','Working','Tomorrow 08:00','08:00–16:00',44,45,46,87,5,
    '{"Receiving":2,"Dispatch":1,"Prep Kitchen":3,"Driving":0,"Customer Service":1,"Stock Handling":3,"Device Operation":5}',
    '["Mon","Tue","Wed","Thu","Fri","Sat"]','["Sun"]','Mornings','["Bench Scale 1"]',
    'Packing','Soup Mix pack',null,'Bench Scale 1'),
  -- SALES (5) --------------------------------------------------------------
  ('Zinhle Khoza','Sales lead','Sales','Working','Tomorrow 08:00','08:00–16:00',39,40,68,95,8,
    '{"Receiving":1,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":5,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Sales','Key account orders',null,null),
  ('Pieter Steyn','Sales rep','Sales','Working','Tomorrow 08:00','08:00–16:00',38,40,52,89,7,
    '{"Receiving":1,"Dispatch":1,"Prep Kitchen":0,"Driving":1,"Customer Service":4,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Sales','Phone enquiries',null,null),
  ('Nadia Abrahams','Sales rep','Sales','Working','Tomorrow 08:00','08:00–16:00',39,40,52,92,8,
    '{"Receiving":1,"Dispatch":1,"Prep Kitchen":0,"Driving":0,"Customer Service":5,"Stock Handling":1,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Sales','Customer orders',null,null),
  ('Bheki Ngcobo','Sales rep','Sales','Working','Tomorrow 08:00','08:00–16:00',38,40,50,88,6,
    '{"Receiving":1,"Dispatch":1,"Prep Kitchen":0,"Driving":1,"Customer Service":4,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Sales','New customer onboarding',null,null),
  ('Chantelle Fortuin','Account manager','Sales','Working','Tomorrow 08:00','08:00–16:00',40,40,58,96,9,
    '{"Receiving":1,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":5,"Stock Handling":1,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Sales','Account reviews',null,null),
  -- ADMIN (3) --------------------------------------------------------------
  ('Megan Daniels','Operations admin','Admin','Working','Tomorrow 08:00','08:00–17:00',40,40,62,98,12,
    '{"Receiving":2,"Dispatch":2,"Prep Kitchen":0,"Driving":0,"Customer Service":4,"Stock Handling":2,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Admin','Timesheets & approvals',null,null),
  ('Sarah Jacobs','Finance officer','Admin','Working','Tomorrow 08:00','08:00–17:00',40,40,70,97,11,
    '{"Receiving":1,"Dispatch":1,"Prep Kitchen":0,"Driving":0,"Customer Service":3,"Stock Handling":1,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Admin','Invoicing & reconciliation',null,null),
  ('Rajesh Naidoo','HR officer','Admin','Working','Tomorrow 08:00','08:00–17:00',39,40,66,95,13,
    '{"Receiving":1,"Dispatch":1,"Prep Kitchen":0,"Driving":0,"Customer Service":4,"Stock Handling":1,"Device Operation":1}',
    '["Mon","Tue","Wed","Thu","Fri"]','["Sat","Sun"]','Days','[]',
    'Admin','Leave & rostering admin',null,null)
) as v(name, role, department, status, next_shift, shift_time,
       hours_this_week, contracted_hours, rate, attendance_score, leave_balance,
       skills, available_days, unavailable_days, preferred_shifts, devices,
       current_department, current_task, current_recipe, assigned_device);

-- ===========================================================================
-- 3. Roster — one row per employee, a 7-day pattern (Mon..Sun) as jsonb `days`.
--    Each cell: {time, department, status, conflict?}. status: scheduled|open|
--    off|leave. open_shifts (shared) listed on every row so a single row yields
--    the RosterWeek. Conflicts illustrate overtime/leave/short/double-booked.
-- ===========================================================================
delete from sb_roster_shifts where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into sb_roster_shifts (org_id, employee_id, name, role, department, label, days, open_shifts)
select o.id, e.id, v.name, e.role, e.department, 'Week of 30 Jun', v.days::jsonb,
  '[{"day":"Wed","department":"Dispatch","time":"13–21"},{"day":"Thu","department":"Receiving","time":"06–12"},{"day":"Fri","department":"Drivers","time":"06–14"}]'::jsonb
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Themba Zulu','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"08–14","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Bongani Sithole','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Sibusiso Ndlovu','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled","conflict":"Overtime risk"},{"time":"08–14","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Pieter Botha','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Lwazi Dube','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"08–14","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Karabo Molefe','[{"time":"","status":"off"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Ahmed Patel','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Johan Smit','[{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled"},{"time":"07–15","department":"Cold Store","status":"scheduled","conflict":"Overtime risk"},{"time":"08–14","department":"Cold Store","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Kabelo Nkosi','[{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–14","department":"Dispatch","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Riaan van Wyk','[{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled","conflict":"Department short"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Nomsa Dlamini','[{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Tshepo Mahlangu','[{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–16","department":"Dispatch","status":"scheduled"},{"time":"08–14","department":"Dispatch","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Yusuf Cassiem','[{"time":"","status":"off"},{"time":"","status":"off"},{"time":"","status":"off"},{"time":"","status":"off"},{"time":"","status":"off"},{"time":"","status":"leave"},{"time":"","status":"leave"}]'),
  ('Lerato Pillay','[{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"09–17","department":"Dispatch","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('David Maluleke','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"leave","conflict":"Leave conflict"},{"time":"06–12","department":"Drivers","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Fanie Pretorius','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Johan Botha','[{"time":"","status":"leave"},{"time":"","status":"leave"},{"time":"06–14","department":"Drivers","status":"scheduled","conflict":"Leave conflict"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Sipho Khumalo','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–12","department":"Drivers","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Andre Williams','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Mandla Khoza','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled","conflict":"Overtime risk"},{"time":"06–12","department":"Drivers","status":"scheduled","conflict":"Double booked"},{"time":"","status":"off"}]'),
  ('Gift Mthembu','[{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–14","department":"Drivers","status":"scheduled"},{"time":"06–12","department":"Drivers","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Aisha Patel','[{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Naledi Mahlangu','[{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Wandile Zwane','[{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Chris Adams','[{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"07–15","department":"Receiving","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Thabo Mokoena','[{"time":"11–17","department":"Receiving","status":"scheduled"},{"time":"11–17","department":"Receiving","status":"scheduled"},{"time":"11–17","department":"Receiving","status":"scheduled"},{"time":"11–17","department":"Receiving","status":"scheduled"},{"time":"11–17","department":"Receiving","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Thandi Mokoena','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Zanele Cele','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Precious Ngwenya','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Ridwaan Isaacs','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled","conflict":"Overtime risk"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Lindiwe Sibiya','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Katlego Tau','[{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–16","department":"Packing","status":"scheduled"},{"time":"08–14","department":"Packing","status":"scheduled"},{"time":"","status":"off"}]'),
  ('Zinhle Khoza','[{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Pieter Steyn','[{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Nadia Abrahams','[{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Bheki Ngcobo','[{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Chantelle Fortuin','[{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"08–16","department":"Sales","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Megan Daniels','[{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Sarah Jacobs','[{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]'),
  ('Rajesh Naidoo','[{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"08–17","department":"Admin","status":"scheduled"},{"time":"","status":"off"},{"time":"","status":"off"}]')
) as v(name, days)
join sb_employees e on e.org_id = o.id and e.name = v.name;

-- ===========================================================================
-- 4. Attendance — one row per employee rostered TODAY (Mon). Excludes those on
--    leave (Yusuf, Johan Botha) and off (Karabo). Clock in/out + hours + status.
-- ===========================================================================
delete from sb_attendance where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into sb_attendance (org_id, employee_id, name, department, scheduled, clock_in, clock_out, hours_worked, status, overtime)
select o.id, e.id, v.name, e.department, v.scheduled, v.clock_in, v.clock_out, v.hours_worked, v.status, v.overtime
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Themba Zulu','07:00–15:00','06:54',null,5.2,'On time',0),
  ('Bongani Sithole','07:00–15:00','06:58',null,5.0,'On time',0),
  ('Sibusiso Ndlovu','07:00–15:00','07:01',null,5.0,'On time',0),
  ('Pieter Botha','07:00–15:00','06:49',null,5.2,'Manual review',0),
  ('Lwazi Dube','07:00–15:00','06:57',null,5.1,'On time',0),
  ('Ahmed Patel','07:00–15:00','07:03',null,5.0,'On time',0),
  ('Johan Smit','07:00–15:00','07:22',null,4.6,'Late',0),
  ('Kabelo Nkosi','08:00–16:00','07:58',null,4.0,'On time',0),
  ('Riaan van Wyk','09:00–17:00','09:19',null,2.7,'Late',0),
  ('Nomsa Dlamini','08:00–16:00','07:56',null,4.1,'On time',0),
  ('Tshepo Mahlangu','08:00–16:00','08:02',null,4.0,'On time',0),
  ('Lerato Pillay','09:00–17:00','08:55',null,3.1,'On time',0),
  ('David Maluleke','06:00–14:00','05:58',null,6.0,'On time',0),
  ('Fanie Pretorius','06:00–14:00',null,null,0,'Absent',0),
  ('Sipho Khumalo','06:00–14:00','05:55',null,6.1,'On time',0),
  ('Andre Williams','06:00–14:00','06:04',null,6.0,'On time',0),
  ('Mandla Khoza','06:00–14:00','06:01',null,6.0,'On time',0),
  ('Gift Mthembu','06:00–14:00','05:59',null,6.0,'On time',0),
  ('Aisha Patel','07:00–15:00','06:55',null,5.1,'On time',0),
  ('Naledi Mahlangu','07:00–15:00','07:02',null,5.0,'On time',0),
  ('Wandile Zwane','07:00–15:00','06:59',null,5.0,'On time',0),
  ('Chris Adams','07:00–15:00','06:52',null,5.1,'On time',0),
  ('Thabo Mokoena','11:00–17:00',null,null,0,'Manual review',0),
  ('Thandi Mokoena','08:00–16:00','07:54',null,4.1,'On time',0),
  ('Zanele Cele','08:00–16:00','08:01',null,4.0,'On time',0),
  ('Precious Ngwenya','08:00–16:00','07:57',null,4.0,'On time',0),
  ('Ridwaan Isaacs','08:00–16:00','07:48',null,4.2,'On time',0),
  ('Lindiwe Sibiya','08:00–16:00','08:03',null,4.0,'On time',0),
  ('Katlego Tau','08:00–16:00','08:14',null,3.8,'Late',0),
  ('Zinhle Khoza','08:00–16:00','07:52',null,4.1,'On time',0),
  ('Pieter Steyn','08:00–16:00','08:05',null,4.0,'On time',0),
  ('Nadia Abrahams','08:00–16:00','07:58',null,4.0,'On time',0),
  ('Bheki Ngcobo','08:00–16:00','08:09',null,3.9,'Late',0),
  ('Chantelle Fortuin','08:00–16:00','07:55',null,4.1,'On time',0),
  ('Megan Daniels','08:00–17:00','07:49',null,4.2,'On time',0),
  ('Sarah Jacobs','08:00–17:00','07:51',null,4.2,'On time',0),
  ('Rajesh Naidoo','08:00–17:00','07:57',null,4.1,'On time',0)
) as v(name, scheduled, clock_in, clock_out, hours_worked, status, overtime)
join sb_employees e on e.org_id = o.id and e.name = v.name;

-- ===========================================================================
-- 5. Leave requests — 6 realistic requests, mix of Pending/Approved, with
--    coverage_impact + coverage_risk. start_date drives the natural-sort index.
-- ===========================================================================
delete from sb_leave_requests where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into sb_leave_requests (org_id, employee_id, name, department, type, start_label, end_label, start_date, days, coverage_impact, coverage_risk, status)
select o.id, e.id, v.name, e.department, v.type, v.start_label, v.end_label, v.start_date::date, v.days, v.coverage_impact, v.coverage_risk, v.status
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Johan Botha','Annual leave','30 Jun','1 Jul','2026-06-30',2,'Drivers thin today — Fanie absent, so cover is tight on the early route.','low','Approved'),
  ('Yusuf Cassiem','Annual leave','30 Jun','4 Jul','2026-06-30',5,'Dispatch loses a picker all week — Tshepo absorbs the load, manageable.','low','Approved'),
  ('Aisha Patel','Sick leave','3 Jul','3 Jul','2026-07-03',1,'Receiving stays covered — Naledi leads, Wandile and Chris on shift.','low','Pending'),
  ('David Maluleke','Annual leave','Fri 4 Jul','Fri 4 Jul','2026-07-04',1,'Approving this leaves Drivers short by 1 on the busiest delivery day (Fri +18% volume).','high','Pending'),
  ('Thabo Mokoena','Family responsibility','5 Jul','5 Jul','2026-07-05',1,'Receiving tight on Saturday morning intake — consider an open shift.','low','Pending'),
  ('Sibusiso Ndlovu','Annual leave','7 Jul','11 Jul','2026-07-07',5,'Cold Store drops to 7 of 8 for the week — Floor Scale 2 cover shifts to Ahmed.','high','Pending')
) as v(name, type, start_label, end_label, start_date, days, coverage_impact, coverage_risk, status)
join sb_employees e on e.org_id = o.id and e.name = v.name;

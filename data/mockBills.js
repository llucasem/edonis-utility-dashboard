export const MOCK_BILLS_INITIAL = [
  { id:1,  type:'electricity', property:'3842 Sunset Blvd, Los Angeles CA',    unit:'Unit 4B',   account:'7235', amount:127.29,  due:'Apr 15', status:'pending' },
  { id:2,  type:'electricity', property:'210 W 77th St, New York NY',           unit:'Unit 12A',  account:'4401', amount:89.50,   due:'Apr 18', status:'paid'    },
  { id:3,  type:'electricity', property:'1190 S Beverly Dr, Los Angeles CA',    unit:'Unit 2',    account:'8812', amount:203.10,  due:'Apr 10', status:'overdue' },
  { id:4,  type:'electricity', property:'740 Park Ave, New York NY',            unit:'Unit 7C',   account:'3390', amount:154.80,  due:'Apr 22', status:'pending' },
  { id:5,  type:'electricity', property:'2001 S Palm Canyon Dr, Palm Springs',  unit:'Unit 1',    account:'6647', amount:98.40,   due:'Apr 25', status:'pending' },
  { id:6,  type:'internet',    property:'3842 Sunset Blvd, Los Angeles CA',     unit:'Unit 4B',   account:'1122', amount:79.99,   due:'Apr 12', status:'paid'    },
  { id:7,  type:'internet',    property:'210 W 77th St, New York NY',           unit:'Unit 12A',  account:'5533', amount:59.99,   due:'Apr 14', status:'pending' },
  { id:8,  type:'internet',    property:'Frognerveien 12, Oslo',                unit:'Apt 3',     account:'9981', amount:64.00,   due:'Apr 20', status:'pending' },
  { id:9,  type:'internet',    property:'1190 S Beverly Dr, Los Angeles CA',    unit:'Unit 2',    account:'7741', amount:79.99,   due:'Apr 08', status:'overdue' },
  { id:10, type:'gas',         property:'3842 Sunset Blvd, Los Angeles CA',     unit:'Unit 4B',   account:'2234', amount:44.20,   due:'Apr 16', status:'pending' },
  { id:11, type:'gas',         property:'740 Park Ave, New York NY',            unit:'Unit 7C',   account:'8821', amount:61.75,   due:'Apr 19', status:'paid'    },
  { id:12, type:'gas',         property:'Frognerveien 12, Oslo',                unit:'Apt 3',     account:'3312', amount:38.90,   due:'Apr 24', status:'pending' },
  { id:13, type:'rent',        property:'3842 Sunset Blvd, Los Angeles CA',     unit:'Unit 4B',   account:'0001', amount:3200.00, due:'Apr 01', status:'paid'    },
  { id:14, type:'rent',        property:'210 W 77th St, New York NY',           unit:'Unit 12A',  account:'0002', amount:4800.00, due:'Apr 01', status:'paid'    },
  { id:15, type:'rent',        property:'Frognerveien 12, Oslo',                unit:'Apt 3',     account:'0003', amount:1850.00, due:'Apr 01', status:'pending' },
  { id:16, type:'insurance',   property:'3842 Sunset Blvd, Los Angeles CA',     unit:'All units', account:'INS1', amount:420.00,  due:'Apr 30', status:'pending' },
  { id:17, type:'insurance',   property:'2001 S Palm Canyon Dr, Palm Springs',  unit:'All units', account:'INS2', amount:380.00,  due:'Apr 30', status:'pending' },
  { id:18, type:'electricity', property:'3842 Sunset Blvd, Los Angeles CA',     unit:'Unit 4B',   account:'7235', amount:127.29,  due:'Apr 15', status:'pending' },
  { id:19, type:'internet',    property:'1190 S Beverly Dr, Los Angeles CA',    unit:'Unit 2',    account:'7741', amount:79.99,   due:'Apr 08', status:'pending' },
];

export const ALL_MONTH_KEYS   = ['2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
export const ALL_MONTH_LABELS = ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'];

export const PROPERTY_MONTHLY = {
  '3842 Sunset Blvd, Los Angeles CA': {
    electricity: [127,130,145,162,148,127,124,132,128,116,138,127],
    internet:    [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80 ],
    gas:         [52, 46, 38, 32, 30, 38, 44, 52, 50, 48, 44, 44 ],
    rent:        [3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200],
    insurance:   [420,420,420,420,420,420,420,420,420,420,420,420],
  },
  '210 W 77th St, New York NY': {
    electricity: [89, 95,105,102, 92, 98, 96,108,100, 90,102, 90],
    internet:    [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    gas:         [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    rent:        [8751,8945,9285,9038,8598,9142,8944,9332,9040,8650,9238,9050],
    insurance:   [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
  },
  '1190 S Beverly Dr, Los Angeles CA': {
    electricity: [480,560,490,580,530,510,550,490,540,510,560,530],
    internet:    [720,790,690,840,770,740,830,710,810,770,840,780],
    gas:         [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    rent:        [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    insurance:   [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
  },
  '740 Park Ave, New York NY': {
    electricity: [1950,2090,2120,2000,1900,2030,2020,2180,2050,1950,2120,2065],
    internet:    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    gas:         [150,160,180,150,150,170,160,170,150,150,160,151],
    rent:        [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    insurance:   [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
  },
  '2001 S Palm Canyon Dr, Palm Springs': {
    electricity: [630,680,780,930,730,660,600,730,660,600,680,718],
    internet:    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    gas:         [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    rent:        [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    insurance:   [420,420,420,420,420,420,420,420,420,420,420,380],
  },
  'Frognerveien 12, Oslo': {
    electricity: [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    internet:    [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64],
    gas:         [38, 40, 42, 44, 40, 38, 36, 40, 38, 36, 38, 39],
    rent:        [2348,2496,2644,2692,2546,2398,2300,2546,2478,2380,2598,1850],
    insurance:   [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
  },
};

export const ANALYTICS_PROPERTIES = Object.keys(PROPERTY_MONTHLY);

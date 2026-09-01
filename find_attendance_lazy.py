with open(r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\components\views\AttendanceView.jsx", 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if any(w in line for w in ['page', 'limit', 'offset', 'fetch', 'scroll', 'lazy', 'loadMore']):
            print(f"Line {idx+1}: {line.strip()}")

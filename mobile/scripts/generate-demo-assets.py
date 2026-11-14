"""Reproducible fictional contract pages and code-drawn RentGuard app icon."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap

assets = Path(__file__).resolve().parents[1] / 'assets'
demo = assets / 'demo'
demo.mkdir(exist_ok=True)
font_dir = Path('C:/Windows/Fonts')
regular = str(font_dir / 'arial.ttf')
bold = str(font_dir / 'arialbd.ttf')
pages = [
    [
        'Điều 1. Giá thuê: 4.000.000 đồng/tháng. Thời hạn thuê 12 tháng.',
        'Điều 2. Tiền đặt cọc là 8.000.000 đồng. Bên thuê chấm dứt trước hạn sẽ mất toàn bộ tiền cọc, bất kể lý do.',
        'Điều 3. Chủ nhà có quyền điều chỉnh giá thuê vào bất kỳ thời điểm nào, không cần báo trước.',
    ],
    [
        'Điều 4. Tiền điện tính 5.000 đồng/kWh. Các chi phí dịch vụ khác sẽ do chủ nhà thông báo sau.',
        'Điều 5. Bên thuê chịu mọi chi phí sửa chữa trong thời gian thuê, bao gồm hư hỏng hệ thống điện nước có sẵn.',
        'Điều 6. Mỗi bên phải thông báo trước 30 ngày khi kết thúc hợp đồng.',
        'Đây là hợp đồng giả định phục vụ thử nghiệm giao diện, không phải tài liệu của người dùng.',
    ],
]
for index, paragraphs in enumerate(pages, 1):
    page = Image.new('RGB', (1240, 1754), '#ffffff')
    draw = ImageDraw.Draw(page)
    draw.rounded_rectangle((90, 90, 1150, 175), radius=16, fill='#E8F0FF')
    draw.text((120, 112), 'RENTGUARD  /  DỮ LIỆU MẪU', font=ImageFont.truetype(bold, 34), fill='#153C83')
    draw.text((100, 245), 'HỢP ĐỒNG THUÊ NHÀ', font=ImageFont.truetype(bold, 54), fill='#153C83')
    draw.text((100, 325), 'Tài liệu giả định để trải nghiệm ứng dụng', font=ImageFont.truetype(regular, 30), fill='#52657F')
    draw.line((100, 400, 1140, 400), fill='#DDE6F2', width=3)
    y = 470
    for paragraph in paragraphs:
        lines = textwrap.wrap(paragraph, width=59)
        for line in lines:
            draw.text((100, y), line, font=ImageFont.truetype(regular, 34), fill='#10233F')
            y += 56
        y += 55
    draw.line((100, 1540, 1140, 1540), fill='#DDE6F2', width=3)
    draw.text((100, 1580), 'Không phải kết quả phân tích AI thực tế.', font=ImageFont.truetype(regular, 30), fill='#52657F')
    draw.text((100, 1640), f'Trang {index} / 2', font=ImageFont.truetype(bold, 30), fill='#153C83')
    page.save(demo / f'page-{index}.jpg', quality=94, subsampling=0, optimize=True)

icon = Image.new('RGB', (1024, 1024), '#2563EB')
draw = ImageDraw.Draw(icon)
draw.polygon([(512, 180), (775, 280), (750, 610), (670, 730), (512, 840), (354, 730), (274, 610), (249, 280)], fill='#FFFFFF')
draw.line([(365, 480), (475, 590), (670, 380)], fill='#2563EB', width=62, joint='curve')
icon.save(assets / 'images' / 'rentguard-icon.png')
icon.resize((96, 96)).save(assets / 'images' / 'rentguard-favicon.png')
print('Generated two fictional contract pages and RentGuard icon.')

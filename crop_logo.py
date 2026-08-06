import base64
import math
from PIL import Image

def crop_and_base64(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Get bounding box by transparency
    bbox = img.getbbox()
    if not bbox:
        print("Image is completely transparent!")
        return
        
    cropped_img = img.crop(bbox)
    
    # Calculate 5% margin
    width, height = cropped_img.size
    max_side = max(width, height)
    margin = math.ceil(max_side * 0.05)
    
    # Create new image with margin
    new_width = width + margin * 2
    new_height = height + margin * 2
    
    padded_img = Image.new("RGBA", (new_width, new_height), (0, 0, 0, 0))
    padded_img.paste(cropped_img, (margin, margin))
    
    # Save the processed image
    padded_img.save(output_path)
    
    # Generate base64
    with open(output_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
    # Write base64 to a text file
    with open(output_path + ".b64", "w") as f:
        f.write("data:image/png;base64," + encoded_string)
        
    print("Done! Width:", new_width, "Height:", new_height)

crop_and_base64('material visual/logo.png', 'processed_logo.png')

from pathlib import Path
import imageio.v2 as imageio

ROOT = Path("/Users/uesugikenshiro/開発/disney-shiori/docs/video/dream-planner-short")
FRAMES = ROOT / "frames"
OUT = ROOT / "output" / "dream-schedule-planner-short.mp4"
OUT.parent.mkdir(parents=True, exist_ok=True)

frame_paths = sorted(FRAMES.glob("frame_*.jpg"))
if not frame_paths:
    raise SystemExit("No frames found. Run render_frames.py first.")

with imageio.get_writer(
    OUT,
    fps=24,
    codec="libx264",
    quality=8,
    macro_block_size=None,
    ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
) as writer:
    for idx, frame_path in enumerate(frame_paths):
        writer.append_data(imageio.imread(frame_path))
        if idx % 48 == 0:
            print(f"encoded {idx}/{len(frame_paths)}")

print(OUT)


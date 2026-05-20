import Foundation
import AVFoundation
import AppKit

let root = URL(fileURLWithPath: "/Users/uesugikenshiro/開発/disney-shiori/docs/video/dream-planner-short")
let framesDir = root.appendingPathComponent("frames")
let output = root.appendingPathComponent("output/dream-schedule-planner-short.mp4")
let width = 1080
let height = 1920
let fps: Int32 = 24
let totalFrames = 22 * Int(fps)

try? FileManager.default.removeItem(at: output)

let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attrs)
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func pixelBuffer(from image: NSImage) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, nil, &pixelBuffer)
    guard let buffer = pixelBuffer else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else {
        CVPixelBufferUnlockBaseAddress(buffer, [])
        return nil
    }
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    if let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    CVPixelBufferUnlockBaseAddress(buffer, [])
    return buffer
}

var frameIndex = 0
while frameIndex < totalFrames {
    if input.isReadyForMoreMediaData {
        let url = framesDir.appendingPathComponent(String(format: "frame_%04d.jpg", frameIndex))
        guard let image = NSImage(contentsOf: url), let buffer = pixelBuffer(from: image) else {
            fatalError("Could not load frame \\(frameIndex)")
        }
        let time = CMTime(value: CMTimeValue(frameIndex), timescale: fps)
        if adaptor.append(buffer, withPresentationTime: time) == false {
            print("append failed at frame \(frameIndex): \(String(describing: writer.error))")
            break
        }
        if frameIndex % 48 == 0 {
            print("encoded \\(frameIndex)/\\(totalFrames)")
        }
        frameIndex += 1
    } else {
        Thread.sleep(forTimeInterval: 0.01)
    }
}

input.markAsFinished()
let group = DispatchGroup()
group.enter()
writer.finishWriting {
    group.leave()
}
group.wait()

if writer.status != .completed {
    print("Export failed: \(String(describing: writer.error))")
    exit(1)
}

print(output.path)

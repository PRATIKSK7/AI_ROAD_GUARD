from ultralytics.hub.session import AGENT_NAME
import os
import argparse
from ultralytics import YOLO
import torch

def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8 on Custom Accident Detection Dataset")
    parser.add_argument(
        "--model", 
        type=str, 
        default="yolov8n.pt", 
        help="Pretrained YOLOv8 model to use (yolov8n.pt, yolov8s.pt, yolov8m.pt)"
    )
    parser.add_argument(
        "--epochs", 
        type=int, 
        default=50, 
        help="Number of epochs to train for"
    )
    parser.add_argument(
        "--batch", 
        type=int, 
        default=16, 
        help="Batch size for training"
    ) 
    parser.add_argument(
        "--imgsz", 
        type=int, 
        default=640, 
        help="Image size for training"
    )
    args = parser.parse_args()

    # Determine device (MPS for Apple Silicon Macs, CPU otherwise)
    if torch.backends.mps.is_available():
        device = "mps"
        print("Using Apple Silicon GPU Acceleration (MPS)")
    elif torch.cuda.is_available():
        device = 0
        print("Using NVIDIA CUDA GPU")
    else:
        device = "cpu"
        print("Using CPU for training")

    # Path to dataset yaml
    data_yaml_path = os.path.abspath("../custom_dataset/data.yaml")
    if not os.path.exists(data_yaml_path):
        raise FileNotFoundError(f"Dataset configuration not found at {data_yaml_path}")

    print(f"Loading pretrained model: {args.model}")
    model = YOLO(args.model)

    print(f"Starting training on {data_yaml_path}...")
    results = model.train(
        data=data_yaml_path,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=device,
        project="runs/detect",
        name="train_accident"
    )

    print("\nTraining completed successfully!")
    print("Trained model weights saved at:")
    print(os.path.abspath(f"runs/detect/train_accident/weights/best.pt"))

if __name__ == "__main__":
    main()

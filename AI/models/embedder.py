"""
Pretrained Sentence Embedding Wrapper

Uses sentence-transformers with frozen weights for text encoding.
Lightweight CPU-only inference.
"""

import torch
from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])
from config import EMBEDDING_MODEL_NAME, EMBEDDING_DIM


class Embedder:
    """
    Wrapper around a pretrained sentence embedding model.
    All weights are frozen - no training.
    """
    
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        """
        Initialize the embedder with a pretrained model.
        
        Args:
            model_name: HuggingFace model name or local path
        """
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.model.eval()  # Ensure eval mode
        
        # Freeze all parameters
        for param in self.model.parameters():
            param.requires_grad = False
            
        self.embedding_dim = EMBEDDING_DIM
        
    def encode(
        self, 
        texts: Union[str, List[str]], 
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        """
        Encode text(s) into embeddings.
        
        Args:
            texts: Single text or list of texts to encode
            batch_size: Batch size for encoding
            normalize: Whether to L2-normalize embeddings
            
        Returns:
            numpy array of shape (n_texts, embedding_dim)
        """
        if isinstance(texts, str):
            texts = [texts]
            
        with torch.no_grad():
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                normalize_embeddings=normalize,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            
        return embeddings
    
    def encode_tensor(
        self, 
        texts: Union[str, List[str]], 
        batch_size: int = 32,
        normalize: bool = True
    ) -> torch.Tensor:
        """
        Encode text(s) into PyTorch tensors.
        
        Args:
            texts: Single text or list of texts to encode
            batch_size: Batch size for encoding
            normalize: Whether to L2-normalize embeddings
            
        Returns:
            torch.Tensor of shape (n_texts, embedding_dim)
        """
        embeddings = self.encode(texts, batch_size, normalize)
        return torch.from_numpy(embeddings).float()



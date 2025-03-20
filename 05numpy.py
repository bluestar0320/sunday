import pandas as pd
import numpy as np
import matplotlib.pyplot as plt



rng = np.random.default_rng(seed=130)
A = rng.standard_normal(7) *5
print(A) #[ 1.17458586  4.72899992 -3.7298003   1.05728258  0.3109221   7.09177091  0.61102489]
print()

remainer, whole = np.modf(A)
print(whole)
print()
print(remainer)
print()
print()

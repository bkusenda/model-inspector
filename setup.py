from setuptools import setup, find_packages
import glob



setup(
    name="modelinspector",
    version="0.0.1-alpha",
    author="Brandyn Kusenda",
    author_email="",
    description="Tool for visualizing a Deep Neural Network",
    long_description='Tool for visualizing a Deep Neural Network',
    url="https://github.com/bkusenda/model-inspector",
    packages=find_packages(),
    include_data_files=True,
    include_package_data=True,
    classifiers=[
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7'
    ],
    python_requires='>=3.7',
)

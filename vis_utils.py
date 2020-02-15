from PIL import ImageDraw
from collections import OrderedDict
from PIL import Image
import numpy
import glob
import seaborn as sns
from matplotlib import cm
import matplotlib as mpl
import IPython.display
from io import StringIO
import PIL.Image
from matplotlib.colors import ListedColormap
import cv2
import matplotlib.pyplot as plt
import cmapy
import numpy as np

from PIL import Image, ImageOps, ImageDraw

def get_concat_h_blank(im1, im2, color=(0, 0, 0)):
    # Source: TODO (internet post)
    dst = Image.new('RGB', (im1.width + im2.width, max(im1.height, im2.height)), color)
    dst.paste(im1, (0, 0))
    dst.paste(im2, (im1.width, 0))
    return dst


def get_concat_v_blank(im1, im2, color=(0, 0, 0)):
    # Source: TODO (internet post)
    dst = Image.new('RGB', (max(im1.width, im2.width), im1.height + im2.height), color)
    dst.paste(im1, (0, 0))
    dst.paste(im2, (0, im1.height))
    return dst


def resize_img(img, w=200, h=None, min_h=None, max_h=None, ignore_resize=False):
    if ignore_resize:
        return img.copy()
    ratio = img.size[1]/img.size[0]
    if h is None:
        h = int(w * ratio)
    if min_h is not None:
        h = max(min_h, h)

    if max_h is not None:
        h = min(max_h, h)
    return img.resize((w, h))

def build_custom_color_map_1():
    custom_map = []

    resolution = 1000
    half = resolution/2
    adj = 0.2
    custom_eps_high_low = resolution * 0.02
    custom_eps_mid = resolution * 0.01
    custom_high = None  # [0.0,.0,1.0,1.0]
    custom_low = None  # [1.0,.0,.0,1.0]
    custom_mid = None  # [0,0,0,1.0]
    for i in range(resolution):
        if custom_low and i <= custom_eps_high_low:
            custom_map.append(custom_low)
            continue
        elif custom_high and (i + custom_eps_high_low) >= (resolution - 1):
            custom_map.append(custom_high)
            continue
        elif custom_mid and (i >= half - custom_eps_mid) and (i <= half + custom_eps_mid):
            custom_map.append(custom_mid)
            continue

        r = 0
        g = 0
        b = 0
        if i < half:
            r = ((half-i)/half)
            r = r + ((1-r) * adj)
        else:
            b = ((i-half)/half)
            b = b + ((1-b) * adj)
        custom_map.append([r, g, b, 1.0])

    # plt.get_cmap('twilight')
    plt_color_map = ListedColormap(np.power(np.asarray(custom_map), 3/2))
    return plt_color_map


CUSTOM_COLOR_MAP = cmapy.cmap(build_custom_color_map_1())


def demo_color_map(plt_color_map):
    gradient = np.linspace(0, 1, 256)
    gradient = np.vstack((gradient, gradient))

    def plot_color_gradients(cmap):
        fig, ax = plt.subplots()
        ax.imshow(gradient, aspect='auto', cmap=cmap)
        pos = list(ax.get_position().bounds)
        x_text = pos[0] - 0.01
        y_text = pos[1] + pos[3]/2.

    plot_color_gradients(plt_color_map)


# Param to Image Processing Functions


def display_img(img, h=200):
    ratio = img.size[1]/img.size[0]
    if w is None:
        w = int(h * ratio)
    IPython.display.display(img.resize((h, w)))


def normalize_local(v):
    vmean = np.mean(v)
    diff = np.max(v)-np.min(v)
    if diff == 0:
        diff = 1
    
    v = (v-vmean) / diff  # TODO or (v - min)/diff *255
    v = (v+1.0) / 2.0
    return v


def normalize(v, vstats):
    if vstats is None:
        return normalize_local(v)
    diff = vstats['max']-vstats['min']
    if diff == 0:
        diff = 1
    v = (v-vstats['mean']) / diff  # TODO or (v - min)/diff *255
    v = (v+1.0) / 2.0
    return v


# NOTE: TOO SLOW, use opencv instead
# def colorize(arr,colormap='plasma'):
#     get_color_helper = np.vectorize(plt.get_cmap(colormap))
#     return np.asarray(get_color_helper(arr)).astype(np.float32).T

def to_rgb(v):
    v = v * 254
    v = v.astype(np.uint8)
    return v

def heatmap_legend(minl,maxl,color_map=cv2.COLORMAP_JET):
    no_change = maxl == minl
    midl = (maxl - minl)/2
    minv = 0
    maxv = 50
    colorw = 10
    texth = 10
    tborder = 5 
    bborder = 5
    rborder = 50
    voffset = tborder - int(texth/2)
    loffset = colorw + 7
    if not no_change:
        val = to_rgb(normalize_local(np.tile(np.arange(minv,maxv).reshape(maxv,1),colorw)))
        val= cv2.applyColorMap(val, color_map)
        
        img = PIL.Image.fromarray(val)

        img = ImageOps.expand(img, border=(3,tborder,rborder,bborder),fill='black')


        draw = ImageDraw.Draw(img)
        draw.text((loffset, maxv -minv+voffset), "{}".format("{}".format(minl), (0, 0, 0)))  # ,font=font))
        draw = ImageDraw.Draw(img)
        draw.text((loffset, maxv - int(maxv/2)+voffset), "{}".format("{}".format(midl), (0, 0, 0)))  # ,font=font))
        draw = ImageDraw.Draw(img)
        draw.text((loffset, voffset), "{}".format("{}".format(maxl), (0, 0, 0)))  # ,font=font))

        return img
    else:
        val = to_rgb(normalize_local(np.tile(np.zeros(maxv).reshape(maxv,1),colorw)))

        img = PIL.Image.fromarray(np.zeros(val.shape))

        img = ImageOps.expand(img, border=(3,tborder,rborder,bborder),fill='black')

        draw = ImageDraw.Draw(img)
        draw.text((loffset, voffset), "{}".format("NO VARIANCE", (0,0,0)))  # ,font=font))
 
        return img
        


def reshape_long_val(val):
    print(val.shape)
    dimmax = max(val.shape[0], val.shape[1])
    dimsize = np.ceil(np.sqrt(dimmax)).astype(int)
    tmp = np.zeros(dimsize**2)
    tmp[:val.size] = val
    val = tmp.reshape(dimsize, dimsize)
    return val

def tensor_to_image(val,
                    use_color_for_3channel_data=False,
                    vstats=None,
                    color_map=cv2.COLORMAP_JET):
    if vstats is None:
        vstats = {
            'min': np.min(val),
            'max':np.max(val),
            'mean': np.mean(val)
        }
    has_color = False
    concat_padding = 1
    if val.ndim == 0:
        val = val.reshape(1)
    if val.ndim == 4:
        # TODO: can be done faster by using numpy operations
        xi = []
        for i in range(val.shape[0]):
            if use_color_for_3channel_data and val.shape[1] == 3:
                xj = np.transpose(val[i], (1, 2, 0))
                has_color = True
                xj = to_rgb(normalize(xj, vstats))
                xj_padded = np.zeros((xj.shape[0],xj.shape[1]+concat_padding,xj.shape[2]),dtype=np.uint8)
                xj_padded[:xj.shape[0],:xj.shape[1],:xj.shape[2]] = xj
            else:
                xj = []
                for j in range(val.shape[1]):
                    xj.append(val[i, j])
                xj = np.concatenate(xj)
                xj = to_rgb(normalize(xj, vstats))

                # xj_padded = np.zeros((xj.shape[0],xj.shape[1]+concat_padding),dtype=np.uint8)
                # xj_padded[:xj.shape[0],:xj.shape[1]] = xj
                xj_padded = xj

            xi.append(xj_padded)
        xall = np.concatenate(xi, axis=1)
    elif val.ndim == 1:
        if val.shape[0] == 1 and vstats is not None:
            if val.dtype == np.int:
                nval = np.zeros(vstats['max']+1)
                nval[val[0]] = 1.0
                xall = to_rgb(normalize(nval, vstats)).reshape(1, nval.shape[0])
            elif val.dtype in (np.float, np.float32, np.float64):
                chunk_count = 10
                if vstats['max'] != 0:
                    chunk_size = vstats['max']/chunk_count
                else:
                    chunk_size = 10
                val_chunk = int(val/chunk_size)
                nval = np.zeros(chunk_count)
                nval[:val_chunk] = 1.0
                xall = to_rgb(normalize(nval, vstats)).reshape(1, nval.shape[0])
            else:
                print("Unsupported dtype {}".format(val.dtype))
        else:
            xall = to_rgb(normalize(val, vstats)).reshape(1, val.shape[0])    
    elif val.ndim == 2:
        if val.shape[0] == 1 and val.shape[1] > 200:
            val = reshape_long_val(val)
        xall = to_rgb(normalize(val, vstats))
    else:
        print('Unsupported number of dims:{}'.format(val.ndim))
        print(val)

    if not has_color:
        xall = cv2.applyColorMap(xall, color_map)
    img = PIL.Image.fromarray(xall)
    return img

def fig2data(fig):
    # Source: http://www.icare.univ-lille1.fr/tutorials/convert_a_matplotlib_figure
    """
    @brief Convert a Matplotlib figure to a 4D numpy array with RGBA channels and return it
    @param fig a matplotlib figure
    @return a numpy 3D array of RGBA values
    """
    # draw the renderer
    fig.canvas.draw()

    # Get the RGBA buffer from the figure
    w, h = fig.canvas.get_width_height()
    buf = numpy.frombuffer(fig.canvas.tostring_argb(), dtype=numpy.uint8)
    buf.shape = (w, h, 4)

    # canvas.tostring_argb give pixmap in ARGB mode. Roll the ALPHA channel to have it in RGBA mode
    buf = numpy.roll(buf, 3, axis=2)
    return buf


def fig2img(fig):
    # Source: http://www.icare.univ-lille1.fr/tutorials/convert_a_matplotlib_figure
    """
    @brief Convert a Matplotlib figure to a PIL Image in RGBA format and return it
    @param fig a matplotlib figure
    @return a Python Imaging Library ( PIL ) image
    """

    # put the figure pixmap into a numpy array
    buf = fig2data(fig)
    w, h, d = buf.shape
    return Image.frombytes("RGBA", (w, h), buf.tostring())


def tensor_to_dist(val, vstats=None):
    bins = min(int(val.size/10)+2, 100)
    if bins < 1:
        return None
    fig = plt.figure()
    use_kde = False #(bins > 20)
    use_rug = False
    if vstats is not None:
        mmin = vstats['min']
        mmax = vstats['max']
        if mmin < 0:
            mmin = - max(abs(mmin), abs(mmax))
            mmax = max(abs(mmin), abs(mmax))
        sns_plot = sns.distplot(val.ravel(), rug=use_rug, bins=bins, hist=True, kde=use_kde, hist_kws={"range": [mmin, mmax]})
    else:
        sns_plot = sns.distplot(val.ravel(), bins=bins, rug=use_rug, hist=True, kde=use_kde)
    img = fig2img(sns_plot.get_figure())
    plt.close()
    return img

def tensor_to_dist_reshape(val, vstats=None):
    bins = min(int(val.size/10)+2, 100)
    if bins < 1:
        return None
    fig = plt.figure()
    if vstats is not None:
        mmin = vstats['min']
        mmax = vstats['max']
        if mmin < 0:
            mmin = - max(abs(mmin), abs(mmax))
            mmax = max(abs(mmin), abs(mmax))
        sns_plot = sns.distplot(val.reshape((val.size)), rug=True, bins=bins, hist=True, kde=(bins > 20), hist_kws={"range": [mmin, mmax]})
    else:
        sns_plot = sns.distplot(val.reshape((val.size)), bins=bins, rug=True, hist=True, kde=(bins > 20))
    img = fig2img(sns_plot.get_figure())
    plt.close()
    return img





def build_net_image(forward_call_order,
                    trace,
                    net_data_stats=None,
                    width=200,
                    min_h=40,
                    max_h=200,
                    hide_tensors=False,
                    ignore_resize=True,
                    include_param_delta=True,
                    show_tensor_dist=False,
                    show_param_dist=False,
                    show_grad_dist = False,
                    stats_suffix="__stats"):
    f_image = None
    seen = OrderedDict()

    for data_key in forward_call_order:
        data = trace.get(data_key, None)
        if data_key in seen:
            continue
        seen[data_key] = True
        if data is None:
            continue
        if data['type'] == 'tensor' and hide_tensors is False:
            tstats = net_data_stats[data_key]
            img = resize_img(tensor_to_image(data['value'],
                                             use_color_for_3channel_data=True,
                                             vstats=tstats,
                                             color_map=CUSTOM_COLOR_MAP),
                             width,
                             min_h=min_h,
                             max_h=max_h,
                             ignore_resize=ignore_resize)
            if data['value'].size > 2 and show_tensor_dist:
                img_g = tensor_to_dist(data['value'], vstats=tstats)
                if img_g is not None:
                    img_g = resize_img(img_g,
                                       width,
                                       min_h=min_h,
                                       max_h=max_h,
                                       ignore_resize=ignore_resize)

                    img = get_concat_h_blank(img, img_g)

            if data_key == 'labels' or data_key == 'loss' or data_key == 'x4_fc3':
                draw = ImageDraw.Draw(img)
                draw.text((0, 0), "{}".format(data['value'], (255, 255, 255)))  # ,font=font))
        elif data['type'] == 'param':
            img = None
            for param_name in ['weight', 'bias']:
                if param_name not in data['value']:
                    continue

                # GRADIENT IMAGE
                grad_stats = net_data_stats[data_key][param_name]['grad__stats']
                im1 = tensor_to_image(data['value'][param_name]['grad'], vstats=None, color_map=CUSTOM_COLOR_MAP)
                im1 = resize_img(im1,
                                 width,
                                 min_h=min_h,
                                 max_h=max_h,
                                 ignore_resize=ignore_resize)

                if show_grad_dist:
                    im1_g = tensor_to_dist(data['value'][param_name]['grad'], vstats=grad_stats)
                    if im1_g is not None:
                        im1_g = resize_img(im1_g,
                                        width,
                                        min_h=min_h,
                                        max_h=max_h,
                                        ignore_resize=ignore_resize)

                        im1 = get_concat_h_blank(im1, im1_g)

                param_stats = net_data_stats[data_key][param_name]['param__stats']
                im2 = tensor_to_image(data['value'][param_name]['param'], vstats=param_stats, color_map=cv2.COLORMAP_JET)
                im2 = resize_img(im2,
                                 width,
                                 min_h=min_h,
                                 max_h=max_h,
                                 ignore_resize=ignore_resize)
                p_img = get_concat_h_blank(im1, im2)

                # PARAM IMAGE
                if show_param_dist:
                    im2_g = tensor_to_dist(data['value'][param_name]['param'], vstats=param_stats)
                    if im2_g is not None:
                        im2_g = resize_img(im2_g,
                                           width,
                                           min_h=min_h,
                                           max_h=max_h,
                                           ignore_resize=ignore_resize)

                        p_img = get_concat_h_blank(p_img, im2_g)

                # DELTA IMAGE
                delta_name = 'param_first_delta'  # 'param_cum_delta_normed__stats'
                if include_param_delta:  # param_first_delta
                    delta_stats = net_data_stats[data_key][param_name]["{}{}".format(delta_name, stats_suffix)]
                    im3 = tensor_to_image(data['value'][param_name][delta_name], vstats=delta_stats, color_map=CUSTOM_COLOR_MAP)  # cv2.COLORMAP_HOT)

                    im3 = resize_img(im3,
                                     width,
                                     min_h=min_h,
                                     max_h=max_h,
                                     ignore_resize=ignore_resize)

                    p_img = get_concat_h_blank(p_img, im3)
                if img is None:
                    img = p_img
                else:
                    img = get_concat_v_blank(img, p_img)
            #print("Skipping {}".format(data_key))
        else:
            continue

        if img is None:
            continue
        elif f_image is None:
            f_image = img
        else:
            f_image = get_concat_v_blank(f_image, img)
    return f_image
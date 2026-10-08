# Janela GTK "de trás" para o teste de interação: registra onde recebeu cliques.
import gi

gi.require_version('Gtk', '4.0')
from gi.repository import Gtk

app = Gtk.Application(application_id='dev.kobi.BehindWindow')


def activate(app):
    window = Gtk.ApplicationWindow(application=app, title='behind')
    window.set_default_size(1800, 1100)
    area = Gtk.DrawingArea()
    window.set_child(area)
    click = Gtk.GestureClick()
    click.connect('pressed', lambda _g, _n, x, y: print('BEHIND-CLICK', int(x), int(y), flush=True))
    area.add_controller(click)
    window.present()


app.connect('activate', activate)
app.run([])

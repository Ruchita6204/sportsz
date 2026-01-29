#from django.shortcuts import HttpResponse
#def home(request):
#    return HttpResponse("SportsZ Backend Running")

# Create your views here.

from django.shortcuts import render
def home(request):
    context={'username':'ruchita'}
    return render(request, 'dashboard/index.html', context)


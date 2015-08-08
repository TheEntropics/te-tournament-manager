(function ($) {
  $('.spinner .btn:first-of-type').on('click', function() {
    var spinner = $(this).parents(".spinner");
    var input = spinner.find("input");
    var step = spinner.data("step") ? spinner.data("step") : 1;
    var value = parseInt(input.val(), 10) + step;
    var min = spinner.data("min") ? spinner.data("min") : undefined;
    var max = spinner.data("max") ? spinner.data("max") : undefined;
    if (min !== undefined) {
      value = value < min ? min : value;
    }
    if (max !== undefined) {
      value = value > max ? max : value;
    }
    input.val(value);
  });
  $('.spinner .btn:last-of-type').on('click', function() {
    var spinner = $(this).parents(".spinner");
    var input = spinner.find("input");
    var step = spinner.data("step") ? spinner.data("step") : 1;
    var value = parseInt(input.val(), 10) - step;
    var min = spinner.data("min") ? spinner.data("min") : undefined;
    var max = spinner.data("max") ? spinner.data("max") : undefined;
    if (min !== undefined) {
      value = value < min ? min : value;
    }
    if (max !== undefined) {
      value = value > max ? max : value;
    }
    input.val(value);
  });
})(jQuery);
